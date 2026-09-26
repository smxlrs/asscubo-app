-- Registration integrity, optimistic concurrency, historical forms, and account cleanup.
-- Apply after 039. This migration does not remove stored attachment objects.
BEGIN;

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS revision BIGINT NOT NULL DEFAULT 1;
ALTER TABLE public.event_registrations
  ADD COLUMN IF NOT EXISTS revision BIGINT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS form_snapshot JSONB;
UPDATE public.event_registrations r SET form_snapshot = e.registration_form
FROM public.events e WHERE e.id = r.event_id AND r.form_snapshot IS NULL;
ALTER TABLE public.event_registrations ALTER COLUMN form_snapshot SET DEFAULT '[]'::JSONB;
ALTER TABLE public.event_registrations ALTER COLUMN form_snapshot SET NOT NULL;

-- Correct only explicitly date-only, still-active events. The next local
-- midnight accounts for Rome's 23/25-hour daylight-saving transition days.
WITH date_only_events AS (
  SELECT e.id,
    ((((CASE WHEN e.has_end_date IS FALSE THEN e.start_time ELSE e.end_time END
      AT TIME ZONE 'Europe/Rome')::DATE + 1)::TIMESTAMP AT TIME ZONE 'Europe/Rome')
      - interval '1 millisecond') AS normalized_end
  FROM public.events e
  WHERE e.end_has_time IS FALSE AND e.deleted_at IS NULL
    AND e.registration_status NOT IN ('archived', 'ended')
    AND isfinite(CASE WHEN e.has_end_date IS FALSE THEN e.start_time ELSE e.end_time END)
)
UPDATE public.events e SET end_time = d.normalized_end, updated_at = now()
FROM date_only_events d WHERE e.id = d.id AND e.end_time IS DISTINCT FROM d.normalized_end;

-- Migration 027 briefly encoded one person's answers inside an internal array.
-- Normalize only unambiguous single-person rows; retain the exact old values in
-- the administrator-only audit log. Multi-person legacy records remain intact.
WITH legacy AS (
  SELECT r.id, r.event_id, r.answers AS original_answers,
    (SELECT a.answers FROM public.event_registration_attendees a WHERE a.registration_id = r.id LIMIT 1) AS original_attendee_answers,
    (r.answers - '__attendee_answers') || (r.answers -> '__attendee_answers' -> 0) AS normalized_answers
  FROM public.event_registrations r
  WHERE r.participant_count = 1
    AND CASE WHEN jsonb_typeof(r.answers -> '__attendee_answers') = 'array'
      THEN jsonb_array_length(r.answers -> '__attendee_answers') ELSE 0 END = 1
    AND jsonb_typeof(r.answers -> '__attendee_answers' -> 0) = 'object'
    AND (SELECT count(*) FROM public.event_registration_attendees a WHERE a.registration_id = r.id) = 1
), logged AS (
  INSERT INTO public.event_registration_audit_logs(event_id, registration_id, action, details)
  SELECT event_id, id, 'legacy_single_attendee_normalized', jsonb_build_object(
    'original_answers', original_answers, 'original_attendee_answers', original_attendee_answers)
  FROM legacy RETURNING registration_id
), normalized AS (
  UPDATE public.event_registrations r SET answers = l.normalized_answers, updated_at = now()
  FROM legacy l WHERE r.id = l.id RETURNING r.id, r.answers
)
UPDATE public.event_registration_attendees a SET answers = n.answers, updated_at = now()
FROM normalized n WHERE a.registration_id = n.id;

CREATE OR REPLACE FUNCTION public.delete_event_legacy_answer_backup()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  DELETE FROM public.event_registration_audit_logs
  WHERE registration_id = OLD.id AND action = 'legacy_single_attendee_normalized';
  RETURN OLD;
END;
$$;
REVOKE ALL ON FUNCTION public.delete_event_legacy_answer_backup() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS delete_event_legacy_answer_backup ON public.event_registrations;
CREATE TRIGGER delete_event_legacy_answer_backup BEFORE DELETE ON public.event_registrations
FOR EACH ROW EXECUTE FUNCTION public.delete_event_legacy_answer_backup();

CREATE OR REPLACE FUNCTION public.event_revision_guard()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  NEW.revision := OLD.revision + 1;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS event_revision_guard ON public.events;
CREATE TRIGGER event_revision_guard BEFORE UPDATE ON public.events
FOR EACH ROW EXECUTE FUNCTION public.event_revision_guard();
DROP TRIGGER IF EXISTS registration_revision_guard ON public.event_registrations;
CREATE TRIGGER registration_revision_guard BEFORE UPDATE ON public.event_registrations
FOR EACH ROW EXECUTE FUNCTION public.event_revision_guard();

CREATE OR REPLACE FUNCTION public.capture_event_registration_form()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  SELECT registration_form INTO NEW.form_snapshot FROM public.events WHERE id = NEW.event_id;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS event_registration_form_snapshot ON public.event_registrations;
CREATE TRIGGER event_registration_form_snapshot BEFORE INSERT ON public.event_registrations
FOR EACH ROW EXECUTE FUNCTION public.capture_event_registration_form();

-- Keep the reviewed capacity algorithms private. The public entry points below
-- add request validation, queue fairness, and optimistic revision checks.
DO $rename$
DECLARE item TEXT[];
BEGIN
  FOREACH item SLICE 1 IN ARRAY ARRAY[
    ARRAY['submit_event_registration','uuid,text,text,integer,jsonb,jsonb,uuid,text','submit_event_registration_v039_impl'],
    ARRAY['update_event_registration','uuid,text,integer,jsonb,jsonb,uuid','update_event_registration_v039_impl'],
    ARRAY['admin_save_event_config','uuid,jsonb,jsonb','admin_save_event_config_v039_impl'],
    ARRAY['admin_update_event_registration_full','uuid,text,text,text,jsonb,text,uuid,boolean','admin_update_event_registration_full_v039_impl']
  ] LOOP
    IF to_regprocedure(format('public.%s(%s)', item[3], item[2])) IS NULL THEN
      EXECUTE format('ALTER FUNCTION public.%I(%s) RENAME TO %I', item[1], item[2], item[3]);
    END IF;
    EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC, anon, authenticated', item[3], item[2]);
  END LOOP;
END;
$rename$;

CREATE OR REPLACE FUNCTION public.validate_event_form_answers(
  p_form JSONB, p_answers JSONB, p_previous_answers JSONB DEFAULT NULL
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE field JSONB; field_key TEXT; field_type TEXT; answer JSONB; value_text TEXT; extra RECORD;
BEGIN
  IF p_answers IS NULL OR jsonb_typeof(p_answers) <> 'object' THEN
    RAISE EXCEPTION 'Registration answers must be an object.';
  END IF;
  IF p_answers ? '__attendee_answers' THEN
    RAISE EXCEPTION 'Each registration must contain exactly one participant.';
  END IF;
  IF octet_length(p_answers::TEXT) > 262144 THEN RAISE EXCEPTION 'Registration answers are too large.'; END IF;
  FOR extra IN SELECT key, value FROM jsonb_each(p_answers) LOOP
    IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(p_form, '[]'::JSONB)) f
      WHERE f ->> 'key' = extra.key)
      AND extra.value IS DISTINCT FROM (p_previous_answers -> extra.key) THEN
      RAISE EXCEPTION 'Unexpected registration field: %', extra.key;
    END IF;
  END LOOP;
  FOR field IN SELECT value FROM jsonb_array_elements(COALESCE(p_form, '[]'::JSONB)) LOOP
    field_key := NULLIF(field ->> 'key', '');
    IF field_key IS NULL OR (field ->> 'system') = 'true' THEN CONTINUE; END IF;
    field_type := COALESCE(field ->> 'type', 'text');
    answer := p_answers -> field_key;
    IF field_type = 'file' THEN
      -- Legacy attachments can be displayed and preserved, but never added or replaced.
      IF answer IS NOT NULL AND answer <> 'null'::JSONB
         AND answer IS DISTINCT FROM (p_previous_answers -> field_key) THEN
        RAISE EXCEPTION 'File attachments are no longer supported.';
      END IF;
      IF p_previous_answers -> field_key IS NOT NULL
         AND answer IS DISTINCT FROM (p_previous_answers -> field_key) THEN
        RAISE EXCEPTION 'Existing file attachments are read-only.';
      END IF;
      CONTINUE;
    END IF;
    IF answer IS NULL OR answer = 'null'::JSONB
       OR (jsonb_typeof(answer) = 'string' AND btrim(answer #>> '{}') = '')
       OR (jsonb_typeof(answer) = 'array' AND jsonb_array_length(answer) = 0)
       OR (field_type = 'checkbox' AND answer = 'false'::JSONB) THEN
      IF (field ->> 'required') = 'true' THEN
        RAISE EXCEPTION 'Required registration field is missing: %', field_key;
      END IF;
      CONTINUE;
    END IF;
    value_text := CASE WHEN jsonb_typeof(answer) = 'string' THEN answer #>> '{}' ELSE NULL END;
    IF field_type IN ('text', 'textarea') AND value_text IS NULL THEN
      RAISE EXCEPTION 'Invalid text value for field: %', field_key;
    ELSIF field_type = 'email' AND (value_text IS NULL OR value_text !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$') THEN
      RAISE EXCEPTION 'Invalid email value for field: %', field_key;
    ELSIF field_type = 'phone' AND (value_text IS NULL OR value_text !~ '^\+?[0-9 ()-]{5,30}$'
      OR length(regexp_replace(value_text, '[^0-9]', '', 'g')) < 5) THEN
      RAISE EXCEPTION 'Invalid phone value for field: %', field_key;
    ELSIF field_type = 'number' AND jsonb_typeof(answer) <> 'number' THEN
      RAISE EXCEPTION 'Invalid number value for field: %', field_key;
    ELSIF field_type = 'date' THEN
      IF value_text IS NULL OR value_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN
        RAISE EXCEPTION 'Invalid date value for field: %', field_key;
      END IF;
      BEGIN
        IF to_char(value_text::DATE, 'YYYY-MM-DD') <> value_text THEN
          RAISE EXCEPTION 'Invalid date value for field: %', field_key;
        END IF;
      EXCEPTION WHEN datetime_field_overflow OR invalid_datetime_format THEN
        RAISE EXCEPTION 'Invalid date value for field: %', field_key;
      END;
    ELSIF field_type = 'select' AND (value_text IS NULL OR NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(COALESCE(field -> 'options', '[]'::JSONB)) choices(choice)
      WHERE choices.choice = value_text)) THEN
      RAISE EXCEPTION 'Invalid selection for field: %', field_key;
    ELSIF field_type = 'multiselect' THEN
      IF jsonb_typeof(answer) <> 'array' THEN RAISE EXCEPTION 'Invalid selection for field: %', field_key; END IF;
      IF EXISTS (SELECT 1 FROM jsonb_array_elements(answer) selected(item)
        WHERE jsonb_typeof(selected.item) <> 'string' OR NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(COALESCE(field -> 'options', '[]'::JSONB)) choices(choice)
          WHERE choices.choice = (selected.item #>> '{}'))) THEN
        RAISE EXCEPTION 'Invalid selection for field: %', field_key;
      END IF;
    ELSIF field_type = 'checkbox' AND jsonb_typeof(answer) <> 'boolean' THEN
      RAISE EXCEPTION 'Invalid checkbox value for field: %', field_key;
    END IF;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.validate_event_form_answers(JSONB, JSONB, JSONB) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.validate_event_registration_answers(p_event_id UUID, p_answers JSONB)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM public.validate_event_form_answers(
    (SELECT registration_form FROM public.events WHERE id = p_event_id), p_answers, NULL);
END;
$$;
REVOKE ALL ON FUNCTION public.validate_event_registration_answers(UUID, JSONB) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.validate_existing_event_registration_answers(p_registration_id UUID, p_answers JSONB)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE registration_row public.event_registrations%ROWTYPE;
BEGIN
  SELECT * INTO registration_row FROM public.event_registrations WHERE id = p_registration_id;
  IF registration_row.id IS NULL THEN RAISE EXCEPTION 'Registration not found.'; END IF;
  PERFORM public.validate_event_form_answers(registration_row.form_snapshot, p_answers, registration_row.answers);
END;
$$;
REVOKE ALL ON FUNCTION public.validate_existing_event_registration_answers(UUID, JSONB) FROM PUBLIC, anon, authenticated;

-- Use the registration's original form when editing historical answers.
DO $existing_validation$
DECLARE definition TEXT;
  old_validation CONSTANT TEXT := 'PERFORM public.validate_event_registration_answers(reg_row.event_id, COALESCE(p_answers, ''{}''::jsonb));';
  new_validation CONSTANT TEXT := 'PERFORM public.validate_existing_event_registration_answers(p_registration_id, COALESCE(p_answers, ''{}''::jsonb));';
BEGIN
  SELECT pg_get_functiondef('public.update_event_registration_v039_impl(uuid,text,integer,jsonb,jsonb,uuid)'::regprocedure)
  INTO definition;
  IF position(old_validation IN definition) > 0 THEN
    definition := replace(definition, old_validation, new_validation);
  ELSIF position(new_validation IN definition) = 0 THEN
    RAISE EXCEPTION 'Unexpected registration update implementation; apply the reviewed migration 039 before 040.';
  END IF;
  IF position(old_validation IN definition) > 0 OR position(new_validation IN definition) = 0 THEN
    RAISE EXCEPTION 'Could not install historical registration form validation.';
  END IF;
  EXECUTE definition;
END;
$existing_validation$;

-- In administrator-assigned transport, only an administrator can turn an
-- existing waitlist entry into a confirmed passenger. Newcomers must queue too.
DO $admin_waitlist$
DECLARE definition TEXT; anchor TEXT; marker TEXT;
BEGIN
  SELECT pg_get_functiondef('public.update_event_registration_v039_impl(uuid,text,integer,jsonb,jsonb,uuid)'::regprocedure)
  INTO definition;
  anchor := 'PERFORM public.validate_existing_event_registration_answers(p_registration_id, COALESCE(p_answers, ''{}''::jsonb));';
  marker := 'IF reg_row.status = ''waitlist'' AND event_row.vehicle_selection_mode = ''admin'' THEN';
  IF position(marker IN definition) = 0 THEN
    IF position(anchor IN definition) = 0 THEN RAISE EXCEPTION 'Unexpected registration update implementation for administrator waitlist.'; END IF;
    definition := replace(definition, anchor, anchor || E'\n  ' || marker || E'\n    result_status := ''waitlist'';\n  END IF;');
    EXECUTE definition;
  END IF;

  SELECT pg_get_functiondef('public.submit_event_registration_v039_impl(uuid,text,text,integer,jsonb,jsonb,uuid,text)'::regprocedure)
  INTO definition;
  anchor := 'PERFORM public.validate_event_registration_answers(p_event_id, COALESCE(p_answers, ''{}''::jsonb));';
  marker := 'IF event_row.vehicle_selection_mode = ''admin'' AND EXISTS (';
  IF position(marker IN definition) = 0 THEN
    IF position(anchor IN definition) = 0 THEN RAISE EXCEPTION 'Unexpected registration submit implementation for administrator waitlist.'; END IF;
    definition := replace(definition, anchor, anchor || E'\n  ' || marker ||
      E'\n    SELECT 1 FROM public.event_registrations queued WHERE queued.event_id = p_event_id AND queued.status = ''waitlist''\n  ) THEN\n    result_status := CASE WHEN event_row.allow_waitlist THEN ''waitlist'' ELSE ''full'' END;\n  END IF;');
    EXECUTE definition;
  END IF;
END;
$admin_waitlist$;

-- A self-selected waitlist entry may update its answers while its chosen bus
-- remains full. Confirmed passengers still cannot switch into a full bus.
DO $waitlist_answer_edit$
DECLARE definition TEXT;
  old_branch CONSTANT TEXT := E'    IF used_seats + p_participant_count > vehicle_row.capacity - vehicle_row.reserved_seats THEN\n      RAISE EXCEPTION ''The selected vehicle no longer has enough seats.'';\n    END IF;\n    selected_vehicle := requested_vehicle;';
  new_branch CONSTANT TEXT := E'    IF used_seats + p_participant_count > vehicle_row.capacity - vehicle_row.reserved_seats THEN\n      IF reg_row.status = ''waitlist'' THEN\n        result_status := ''waitlist'';\n      ELSE\n        RAISE EXCEPTION ''The selected vehicle no longer has enough seats.'';\n      END IF;\n    END IF;\n    selected_vehicle := CASE WHEN result_status = ''confirmed'' THEN requested_vehicle ELSE NULL END;';
BEGIN
  SELECT replace(pg_get_functiondef('public.update_event_registration_v039_impl(uuid,text,integer,jsonb,jsonb,uuid)'::regprocedure), E'\r\n', E'\n')
  INTO definition;
  IF position(old_branch IN definition) > 0 THEN
    EXECUTE replace(definition, old_branch, new_branch);
  ELSIF position(new_branch IN definition) = 0 THEN
    RAISE EXCEPTION 'Unexpected registration update implementation for self-selected waitlist.';
  END IF;
END;
$waitlist_answer_edit$;

-- Keep the private capacity routines consistent with the lock-aware public
-- checks. Only eligibility guards use wall-clock time; queue timestamps retain
-- their original transaction-time semantics.
DO $eligibility_clock$
DECLARE signature TEXT; definition TEXT;
BEGIN
  FOREACH signature IN ARRAY ARRAY[
    'public.submit_event_registration_v039_impl(uuid,text,text,integer,jsonb,jsonb,uuid,text)',
    'public.update_event_registration_v039_impl(uuid,text,integer,jsonb,jsonb,uuid)'
  ] LOOP
    SELECT pg_get_functiondef(signature::regprocedure) INTO definition;
    IF position('IF now() > event_row.end_time' IN definition) = 0
       AND position('IF clock_timestamp() > event_row.end_time' IN definition) = 0 THEN
      RAISE EXCEPTION 'Unexpected registration eligibility implementation: %', signature;
    END IF;
    definition := replace(definition, 'AND now() < event_row.registration_start_at', 'AND clock_timestamp() < event_row.registration_start_at');
    definition := replace(definition, 'AND now() > event_row.registration_deadline', 'AND clock_timestamp() > event_row.registration_deadline');
    definition := replace(definition, 'IF now() > event_row.end_time', 'IF clock_timestamp() > event_row.end_time');
    IF position('now() < event_row.registration_start_at' IN definition) > 0
       OR position('now() > event_row.registration_deadline' IN definition) > 0
       OR position('now() > event_row.end_time' IN definition) > 0 THEN
      RAISE EXCEPTION 'Could not install wall-clock registration eligibility: %', signature;
    END IF;
    EXECUTE definition;
  END LOOP;
END;
$eligibility_clock$;

CREATE OR REPLACE FUNCTION public.require_event_registration_open(p_event_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE event_row public.events%ROWTYPE;
BEGIN
  SELECT * INTO event_row FROM public.events WHERE id = p_event_id FOR UPDATE;
  IF event_row.id IS NULL OR event_row.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'Event does not exist.'; END IF;
  IF NOT event_row.is_published OR event_row.registration_status <> 'open' THEN
    RAISE EXCEPTION 'Registration is not open for this event.';
  END IF;
  IF event_row.registration_start_at IS NOT NULL AND clock_timestamp() < event_row.registration_start_at THEN
    RAISE EXCEPTION 'Registration has not opened yet.';
  END IF;
  IF event_row.registration_deadline IS NOT NULL AND clock_timestamp() > event_row.registration_deadline THEN
    RAISE EXCEPTION 'Registration deadline has passed.';
  END IF;
  IF clock_timestamp() > event_row.end_time THEN RAISE EXCEPTION 'This event has already ended.'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.require_event_registration_open(UUID) FROM PUBLIC, anon, authenticated;

-- now() is the transaction start, which can predate a long wait for the event
-- lock. Check the actual clock after acquiring that lock and before each move.
CREATE OR REPLACE FUNCTION public.promote_event_waitlist(p_event_id UUID)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  event_row public.events%ROWTYPE;
  reg_row public.event_registrations%ROWTYPE;
  vehicle_row public.event_vehicles%ROWTYPE;
  assigned_vehicle UUID; confirmed_count INTEGER; occupied INTEGER; promoted INTEGER := 0;
BEGIN
  SELECT * INTO event_row FROM public.events WHERE id = p_event_id FOR UPDATE;
  IF event_row.id IS NULL OR event_row.deleted_at IS NOT NULL OR NOT event_row.is_published
     OR event_row.registration_status <> 'open'
     OR (event_row.registration_start_at IS NOT NULL AND clock_timestamp() < event_row.registration_start_at)
     OR (event_row.registration_deadline IS NOT NULL AND clock_timestamp() > event_row.registration_deadline)
     OR clock_timestamp() > event_row.end_time THEN RETURN 0; END IF;
  FOR reg_row IN SELECT * FROM public.event_registrations
    WHERE event_id = p_event_id AND status = 'waitlist' ORDER BY registered_at, id FOR UPDATE
  LOOP
    EXIT WHEN (event_row.registration_deadline IS NOT NULL AND clock_timestamp() > event_row.registration_deadline)
      OR clock_timestamp() > event_row.end_time;
    SELECT COALESCE(sum(participant_count), 0)::INTEGER INTO confirmed_count
    FROM public.event_registrations WHERE event_id = p_event_id AND status = 'confirmed';
    IF event_row.max_participants IS NOT NULL
       AND confirmed_count + reg_row.participant_count > event_row.max_participants THEN CONTINUE; END IF;
    assigned_vehicle := NULL;
    IF event_row.vehicle_selection_mode = 'admin' THEN
      CONTINUE;
    ELSIF event_row.vehicle_selection_mode = 'self_select' AND reg_row.requested_vehicle_id IS NOT NULL THEN
      SELECT * INTO vehicle_row FROM public.event_vehicles
      WHERE id = reg_row.requested_vehicle_id AND event_id = p_event_id AND is_active FOR UPDATE;
      IF vehicle_row.id IS NULL THEN CONTINUE; END IF;
      SELECT COALESCE(sum(participant_count), 0)::INTEGER INTO occupied
      FROM public.event_registrations WHERE vehicle_id = vehicle_row.id AND status = 'confirmed';
      IF occupied + reg_row.participant_count > vehicle_row.capacity - vehicle_row.reserved_seats THEN CONTINUE; END IF;
      assigned_vehicle := vehicle_row.id;
    ELSIF event_row.vehicle_selection_mode IN ('auto', 'self_select') THEN
      FOR vehicle_row IN SELECT * FROM public.event_vehicles
        WHERE event_id = p_event_id AND is_active ORDER BY sort_order, name, id FOR UPDATE
      LOOP
        SELECT COALESCE(sum(participant_count), 0)::INTEGER INTO occupied
        FROM public.event_registrations WHERE vehicle_id = vehicle_row.id AND status = 'confirmed';
        IF occupied + reg_row.participant_count <= vehicle_row.capacity - vehicle_row.reserved_seats THEN
          assigned_vehicle := vehicle_row.id; EXIT;
        END IF;
      END LOOP;
      IF assigned_vehicle IS NULL THEN CONTINUE; END IF;
    END IF;
    UPDATE public.event_registrations SET status = 'confirmed', vehicle_id = assigned_vehicle, updated_at = now()
    WHERE id = reg_row.id;
    INSERT INTO public.event_registration_audit_logs(event_id, registration_id, action, details)
    VALUES(p_event_id, reg_row.id, 'waitlist_promoted', jsonb_build_object('vehicle_id', assigned_vehicle));
    promoted := promoted + 1;
  END LOOP;
  RETURN promoted;
END;
$$;
REVOKE ALL ON FUNCTION public.promote_event_waitlist(UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.submit_event_registration(
  p_event_id UUID, p_registration_kind TEXT DEFAULT 'self', p_proxy_note TEXT DEFAULT NULL,
  p_participant_count INTEGER DEFAULT 1, p_answers JSONB DEFAULT '{}'::JSONB,
  p_attendees JSONB DEFAULT '[]'::JSONB, p_vehicle_id UUID DEFAULT NULL, p_source TEXT DEFAULT 'app'
)
RETURNS TABLE (registration_id UUID, registration_status TEXT, assigned_vehicle_id UUID, participant_count INTEGER)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication is required to register.'; END IF;
  IF p_participant_count IS DISTINCT FROM 1 THEN RAISE EXCEPTION 'Each registration must contain exactly one participant.'; END IF;
  PERFORM public.require_event_registration_open(p_event_id);
  PERFORM public.promote_event_waitlist(p_event_id);
  PERFORM public.require_event_registration_open(p_event_id);
  RETURN QUERY SELECT * FROM public.submit_event_registration_v039_impl(
    p_event_id, p_registration_kind, p_proxy_note, 1, p_answers, p_attendees, p_vehicle_id, p_source);
END;
$$;
REVOKE ALL ON FUNCTION public.submit_event_registration(UUID, TEXT, TEXT, INTEGER, JSONB, JSONB, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_event_registration(UUID, TEXT, TEXT, INTEGER, JSONB, JSONB, UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_event_registration(
  p_registration_id UUID, p_proxy_note TEXT DEFAULT NULL, p_participant_count INTEGER DEFAULT 1,
  p_answers JSONB DEFAULT '{}'::JSONB, p_attendees JSONB DEFAULT '[]'::JSONB,
  p_vehicle_id UUID DEFAULT NULL, p_expected_revision BIGINT DEFAULT NULL
)
RETURNS TABLE (registration_id UUID, registration_status TEXT, assigned_vehicle_id UUID, participant_count INTEGER)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE target_event_id UUID; registration_row public.event_registrations%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication is required.'; END IF;
  IF p_participant_count IS DISTINCT FROM 1 THEN RAISE EXCEPTION 'Each registration must contain exactly one participant.'; END IF;
  SELECT r.event_id INTO target_event_id FROM public.event_registrations r
  WHERE r.id = p_registration_id AND r.user_id = auth.uid();
  IF target_event_id IS NULL THEN RAISE EXCEPTION 'Registration not found.'; END IF;
  PERFORM public.require_event_registration_open(target_event_id);
  SELECT * INTO registration_row FROM public.event_registrations r WHERE r.id = p_registration_id FOR UPDATE;
  IF registration_row.participant_count <> 1 THEN
    RAISE EXCEPTION 'Legacy multi-person registrations are read-only; contact an administrator.';
  END IF;
  IF registration_row.revision IS DISTINCT FROM p_expected_revision THEN
    RAISE EXCEPTION 'Registration changed; reload before saving.';
  END IF;
  IF registration_row.registration_kind = 'proxy' AND
     NOT (SELECT allow_proxy_registration FROM public.events WHERE id = target_event_id) THEN
    RAISE EXCEPTION 'This event does not allow proxy registration.';
  END IF;
  PERFORM public.promote_event_waitlist(target_event_id);
  PERFORM public.require_event_registration_open(target_event_id);
  RETURN QUERY SELECT * FROM public.update_event_registration_v039_impl(
    p_registration_id, p_proxy_note, 1, p_answers, p_attendees, p_vehicle_id);
END;
$$;
REVOKE ALL ON FUNCTION public.update_event_registration(UUID, TEXT, INTEGER, JSONB, JSONB, UUID, BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_event_registration(UUID, TEXT, INTEGER, JSONB, JSONB, UUID, BIGINT) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_save_event_config(
  p_event_id UUID, p_payload JSONB, p_vehicles JSONB, p_expected_revision BIGINT DEFAULT NULL
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE event_row public.events%ROWTYPE; field JSONB; form JSONB; saved_id UUID; seen_keys TEXT[] := '{}'; field_key TEXT;
  normalized_payload JSONB := p_payload; date_source TIMESTAMPTZ; normalized_end TIMESTAMPTZ;
BEGIN
  IF NOT public.has_admin_permission('events.manage') THEN RAISE EXCEPTION 'Event management permission is required.'; END IF;
  IF p_event_id IS NOT NULL THEN
    SELECT * INTO event_row FROM public.events WHERE id = p_event_id AND deleted_at IS NULL FOR UPDATE;
    IF event_row.id IS NULL THEN RAISE EXCEPTION 'Event not found.'; END IF;
    IF event_row.revision IS DISTINCT FROM p_expected_revision THEN RAISE EXCEPTION 'Event changed; reload before saving.'; END IF;
  END IF;
  form := COALESCE(p_payload -> 'registration_form', '[]'::JSONB);
  IF jsonb_typeof(form) <> 'array' THEN RAISE EXCEPTION 'Event form must be a list of fields.'; END IF;
  FOR field IN SELECT value FROM jsonb_array_elements(form) LOOP
    field_key := NULLIF(btrim(field ->> 'key'), '');
    IF field_key IS NULL OR field_key = ANY(seen_keys) OR left(field_key, 2) = '__' THEN
      RAISE EXCEPTION 'Event form field keys must be unique and non-empty.';
    END IF;
    seen_keys := array_append(seen_keys, field_key);
    IF field ->> 'type' = 'file' AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(event_row.registration_form, '[]'::JSONB)) original
      WHERE original = field) THEN RAISE EXCEPTION 'File attachments are no longer supported.'; END IF;
    IF COALESCE(field ->> 'type', '') NOT IN ('text','textarea','email','phone','number','date','select','multiselect','checkbox','file') THEN
      RAISE EXCEPTION 'Invalid event form field type.';
    END IF;
  END LOOP;
  IF (p_payload ->> 'end_has_time')::BOOLEAN IS FALSE THEN
    date_source := CASE WHEN (p_payload ->> 'has_end_date')::BOOLEAN IS FALSE
      THEN (p_payload ->> 'start_time')::TIMESTAMPTZ ELSE (p_payload ->> 'end_time')::TIMESTAMPTZ END;
    IF date_source IS NOT NULL AND isfinite(date_source) THEN
      normalized_end := (((date_source AT TIME ZONE 'Europe/Rome')::DATE + 1)::TIMESTAMP AT TIME ZONE 'Europe/Rome')
        - interval '1 millisecond';
      normalized_payload := jsonb_set(p_payload, '{end_time}', to_jsonb(normalized_end));
    END IF;
  END IF;
  saved_id := public.admin_save_event_config_v039_impl(p_event_id, normalized_payload, p_vehicles);
  PERFORM public.promote_event_waitlist(saved_id);
  RETURN saved_id;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_save_event_config(UUID, JSONB, JSONB, BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_save_event_config(UUID, JSONB, JSONB, BIGINT) TO authenticated;

-- Private implementation used by the revision-checked full admin editor.
CREATE OR REPLACE FUNCTION public.admin_update_event_registration(
  p_registration_id UUID, p_name TEXT, p_phone TEXT DEFAULT NULL, p_email TEXT DEFAULT NULL,
  p_answers JSONB DEFAULT '{}'::JSONB, p_notify BOOLEAN DEFAULT FALSE
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE registration_row public.event_registrations%ROWTYPE; attendee_id UUID;
BEGIN
  IF NOT public.has_admin_permission('events.manage') THEN RAISE EXCEPTION 'Event management permission is required.'; END IF;
  IF NULLIF(btrim(COALESCE(p_name, '')), '') IS NULL OR length(btrim(p_name)) > 200 THEN
    RAISE EXCEPTION 'Each attendee needs a valid name.';
  END IF;
  SELECT * INTO registration_row FROM public.event_registrations WHERE id = p_registration_id FOR UPDATE;
  IF registration_row.id IS NULL THEN RAISE EXCEPTION 'Registration not found.'; END IF;
  PERFORM public.validate_existing_event_registration_answers(p_registration_id, COALESCE(p_answers, '{}'::JSONB));
  SELECT id INTO attendee_id FROM public.event_registration_attendees
  WHERE registration_id = p_registration_id ORDER BY sort_order, id LIMIT 1 FOR UPDATE;
  IF attendee_id IS NULL THEN RAISE EXCEPTION 'Registration attendee not found.'; END IF;
  UPDATE public.event_registrations SET answers = COALESCE(p_answers, '{}'::JSONB), updated_at = now() WHERE id = p_registration_id;
  UPDATE public.event_registration_attendees SET name = btrim(p_name),
    phone = NULLIF(btrim(COALESCE(p_phone, '')), ''), email = NULLIF(lower(btrim(COALESCE(p_email, ''))), ''),
    answers = COALESCE(p_answers, '{}'::JSONB), updated_at = now() WHERE id = attendee_id;
  INSERT INTO public.event_registration_audit_logs(event_id, registration_id, actor_id, action, details)
  VALUES(registration_row.event_id, p_registration_id, auth.uid(), 'admin_updated', jsonb_build_object('notified', p_notify));
END;
$$;
REVOKE ALL ON FUNCTION public.admin_update_event_registration(UUID, TEXT, TEXT, TEXT, JSONB, BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_assign_event_registration(UUID, UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_update_event_registration_full(
  p_registration_id UUID, p_name TEXT, p_phone TEXT, p_email TEXT, p_answers JSONB,
  p_proxy_note TEXT, p_vehicle_id UUID, p_notify BOOLEAN DEFAULT FALSE, p_expected_revision BIGINT DEFAULT NULL
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE target_event_id UUID; current_revision BIGINT; current_participant_count INTEGER;
BEGIN
  IF NOT public.has_admin_permission('events.manage') THEN RAISE EXCEPTION 'Event management permission is required.'; END IF;
  SELECT event_id INTO target_event_id FROM public.event_registrations WHERE id = p_registration_id;
  IF target_event_id IS NULL THEN RAISE EXCEPTION 'Registration not found.'; END IF;
  PERFORM 1 FROM public.events WHERE id = target_event_id FOR UPDATE;
  SELECT revision, participant_count INTO current_revision, current_participant_count
  FROM public.event_registrations WHERE id = p_registration_id FOR UPDATE;
  IF current_participant_count <> 1 THEN
    RAISE EXCEPTION 'Legacy multi-person registrations are read-only; contact an administrator.';
  END IF;
  IF current_revision IS DISTINCT FROM p_expected_revision THEN RAISE EXCEPTION 'Registration changed; reload before saving.'; END IF;
  PERFORM public.admin_update_event_registration_full_v039_impl(
    p_registration_id, p_name, p_phone, p_email, p_answers, p_proxy_note, p_vehicle_id, p_notify);
  IF p_vehicle_id IS NOT NULL AND (SELECT vehicle_selection_mode FROM public.events WHERE id = target_event_id) = 'self_select' THEN
    UPDATE public.event_registrations SET requested_vehicle_id = p_vehicle_id
    WHERE id = p_registration_id AND requested_vehicle_id IS DISTINCT FROM p_vehicle_id;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_update_event_registration_full(UUID, TEXT, TEXT, TEXT, JSONB, TEXT, UUID, BOOLEAN, BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_event_registration_full(UUID, TEXT, TEXT, TEXT, JSONB, TEXT, UUID, BOOLEAN, BIGINT) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_event_registration(p_registration_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE target_event_id UUID; previous_vehicle_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication is required.'; END IF;
  SELECT event_id INTO target_event_id FROM public.event_registrations
  WHERE id = p_registration_id AND (user_id = auth.uid() OR public.has_admin_permission('events.manage'));
  IF target_event_id IS NULL THEN RAISE EXCEPTION 'Registration not found.'; END IF;
  PERFORM 1 FROM public.events WHERE id = target_event_id FOR UPDATE;
  SELECT vehicle_id INTO previous_vehicle_id FROM public.event_registrations WHERE id = p_registration_id FOR UPDATE;
  PERFORM public.cancel_event_registration_locked_impl(p_registration_id);
  UPDATE public.event_registrations SET vehicle_id = previous_vehicle_id
  WHERE id = p_registration_id AND status = 'cancelled' AND vehicle_id IS NULL AND previous_vehicle_id IS NOT NULL;
END;
$$;
CREATE OR REPLACE FUNCTION public.admin_cancel_event_registration(p_registration_id UUID, p_notify BOOLEAN DEFAULT FALSE)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE target_event_id UUID; previous_vehicle_id UUID;
BEGIN
  IF NOT public.has_admin_permission('events.manage') THEN RAISE EXCEPTION 'Event management permission is required.'; END IF;
  SELECT event_id INTO target_event_id FROM public.event_registrations WHERE id = p_registration_id;
  IF target_event_id IS NULL THEN RAISE EXCEPTION 'Registration not found.'; END IF;
  PERFORM 1 FROM public.events WHERE id = target_event_id FOR UPDATE;
  SELECT vehicle_id INTO previous_vehicle_id FROM public.event_registrations WHERE id = p_registration_id FOR UPDATE;
  PERFORM public.admin_cancel_event_registration_locked_impl(p_registration_id, p_notify);
  UPDATE public.event_registrations SET vehicle_id = previous_vehicle_id
  WHERE id = p_registration_id AND status = 'cancelled' AND vehicle_id IS NULL AND previous_vehicle_id IS NOT NULL;
END;
$$;

-- Account removal intentionally removes personal records through existing FKs,
-- but first frees confirmed places and advances eligible waitlists atomically.
CREATE OR REPLACE FUNCTION public.cancel_registrations_before_account_delete()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE target_event_id UUID;
BEGIN
  FOR target_event_id IN SELECT DISTINCT event_id FROM public.event_registrations
    WHERE user_id = OLD.id ORDER BY event_id LOOP
    PERFORM 1 FROM public.events WHERE id = target_event_id FOR UPDATE;
  END LOOP;
  FOR target_event_id IN SELECT DISTINCT event_id FROM public.event_registrations
    WHERE user_id = OLD.id ORDER BY event_id LOOP
    UPDATE public.event_registrations SET status = 'cancelled', cancelled_at = now(), updated_at = now()
    WHERE event_id = target_event_id AND user_id = OLD.id AND status <> 'cancelled';
    PERFORM public.promote_event_waitlist(target_event_id);
  END LOOP;
  RETURN OLD;
END;
$$;
DROP TRIGGER IF EXISTS cancel_registrations_before_account_delete ON auth.users;
CREATE TRIGGER cancel_registrations_before_account_delete BEFORE DELETE ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.cancel_registrations_before_account_delete();

DROP FUNCTION IF EXISTS public.admin_event_registration_page(UUID, INTEGER, INTEGER);
CREATE OR REPLACE FUNCTION public.admin_event_registration_page(
  p_event_id UUID, p_offset INTEGER DEFAULT 0, p_limit INTEGER DEFAULT 100,
  p_before_registered_at TIMESTAMPTZ DEFAULT NULL, p_before_id UUID DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE result JSONB;
BEGIN
  IF NOT public.has_admin_permission('events.manage') THEN RAISE EXCEPTION 'Event management permission is required.'; END IF;
  IF p_offset < 0 OR p_limit < 1 OR p_limit > 200 THEN RAISE EXCEPTION 'Invalid registration page.'; END IF;
  IF (p_before_registered_at IS NULL) <> (p_before_id IS NULL) THEN RAISE EXCEPTION 'Invalid registration page cursor.'; END IF;
  SELECT COALESCE(jsonb_agg(row_data ORDER BY registered_at DESC, id DESC), '[]'::JSONB) INTO result
  FROM (
    SELECT r.id, r.registered_at, to_jsonb(r) || jsonb_build_object(
      'registered_by_name', p.name, 'registered_by_email', u.email,
      'attendees', COALESCE((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.sort_order, a.id)
        FROM public.event_registration_attendees a WHERE a.registration_id = r.id), '[]'::JSONB)) AS row_data
    FROM public.event_registrations r LEFT JOIN public.profiles p ON p.id = r.user_id
      LEFT JOIN auth.users u ON u.id = r.user_id
    WHERE r.event_id = p_event_id
      AND (p_before_registered_at IS NULL OR (r.registered_at, r.id) < (p_before_registered_at, p_before_id))
    ORDER BY r.registered_at DESC, r.id DESC
    LIMIT p_limit OFFSET p_offset
  ) page;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_event_registration_page(UUID, INTEGER, INTEGER, TIMESTAMPTZ, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_event_registration_page(UUID, INTEGER, INTEGER, TIMESTAMPTZ, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_event_registration_snapshot(p_event_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE result JSONB;
BEGIN
  IF NOT public.has_admin_permission('events.manage') THEN RAISE EXCEPTION 'Event management permission is required.'; END IF;
  SELECT jsonb_build_object(
    'event', to_jsonb(e),
    'vehicles', COALESCE((SELECT jsonb_agg(to_jsonb(v) ORDER BY v.sort_order, v.id)
      FROM public.event_vehicles v WHERE v.event_id = e.id), '[]'::JSONB),
    'registrations', COALESCE((SELECT jsonb_agg(to_jsonb(r) || jsonb_build_object(
      'registered_by_name', p.name, 'registered_by_email', u.email,
      'attendees', COALESCE((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.sort_order, a.id)
        FROM public.event_registration_attendees a WHERE a.registration_id = r.id), '[]'::JSONB)
    ) ORDER BY r.registered_at, r.id)
    FROM public.event_registrations r LEFT JOIN public.profiles p ON p.id = r.user_id
      LEFT JOIN auth.users u ON u.id = r.user_id WHERE r.event_id = e.id), '[]'::JSONB)
  ) INTO result FROM public.events e WHERE e.id = p_event_id;
  IF result IS NULL THEN RAISE EXCEPTION 'Event not found.'; END IF;
  RETURN result;
END;
$$;

-- Configuration writes must use the revision-checked transaction. Archive and
-- deletion get dedicated RPCs below so generic REST writes cannot bypass it.
REVOKE INSERT, UPDATE, DELETE ON public.events, public.event_vehicles FROM authenticated;
CREATE OR REPLACE FUNCTION public.admin_archive_event(p_event_id UUID, p_expected_revision BIGINT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE current_revision BIGINT;
BEGIN
  IF NOT public.has_admin_permission('events.manage') THEN RAISE EXCEPTION 'Event management permission is required.'; END IF;
  SELECT revision INTO current_revision FROM public.events WHERE id = p_event_id FOR UPDATE;
  IF current_revision IS NULL THEN RAISE EXCEPTION 'Event not found.'; END IF;
  IF current_revision IS DISTINCT FROM p_expected_revision THEN RAISE EXCEPTION 'Event changed; reload before saving.'; END IF;
  UPDATE public.events SET registration_status = 'archived', is_published = FALSE, updated_at = now() WHERE id = p_event_id;
END;
$$;
CREATE OR REPLACE FUNCTION public.admin_delete_event(p_event_id UUID, p_expected_revision BIGINT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE current_revision BIGINT;
BEGIN
  IF NOT public.has_admin_permission('events.manage') THEN RAISE EXCEPTION 'Event management permission is required.'; END IF;
  SELECT revision INTO current_revision FROM public.events WHERE id = p_event_id FOR UPDATE;
  IF current_revision IS NULL THEN RAISE EXCEPTION 'Event not found.'; END IF;
  IF current_revision IS DISTINCT FROM p_expected_revision THEN RAISE EXCEPTION 'Event changed; reload before saving.'; END IF;
  UPDATE public.events SET deleted_at = now(), is_published = FALSE,
    registration_status = 'archived', registration_start_notify_enabled = FALSE, updated_at = now()
  WHERE id = p_event_id;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_archive_event(UUID, BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_archive_event(UUID, BIGINT) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_delete_event(UUID, BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_event(UUID, BIGINT) TO authenticated;
DROP POLICY IF EXISTS "Users can upload own event attachments" ON storage.objects;

-- A new registration must describe the form the person actually saw. Field
-- keys alone do not detect an administrator changing a question's wording.
CREATE OR REPLACE FUNCTION public.submit_event_registration_checked(
  p_event_id UUID, p_registration_kind TEXT DEFAULT 'self', p_proxy_note TEXT DEFAULT NULL,
  p_participant_count INTEGER DEFAULT 1, p_answers JSONB DEFAULT '{}'::JSONB,
  p_attendees JSONB DEFAULT '[]'::JSONB, p_vehicle_id UUID DEFAULT NULL, p_source TEXT DEFAULT 'app',
  p_expected_form_version INTEGER DEFAULT NULL
)
RETURNS TABLE (registration_id UUID, registration_status TEXT, assigned_vehicle_id UUID, participant_count INTEGER)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE current_form_version INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication is required to register.'; END IF;
  PERFORM public.require_event_registration_open(p_event_id);
  SELECT registration_form_version INTO current_form_version FROM public.events
  WHERE id = p_event_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Event does not exist.'; END IF;
  IF current_form_version IS DISTINCT FROM p_expected_form_version THEN
    RAISE EXCEPTION 'Event form changed; reload before submitting.';
  END IF;
  RETURN QUERY SELECT * FROM public.submit_event_registration(
    p_event_id, p_registration_kind, p_proxy_note, p_participant_count,
    p_answers, p_attendees, p_vehicle_id, p_source);
END;
$$;
CREATE OR REPLACE FUNCTION public.submit_event_registration_group_checked(
  p_event_id UUID, p_participants JSONB, p_source TEXT DEFAULT 'app',
  p_expected_form_version INTEGER DEFAULT NULL
)
RETURNS TABLE (participant_index INTEGER, registration_id UUID, registration_status TEXT, assigned_vehicle_id UUID)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE current_form_version INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication is required to register.'; END IF;
  PERFORM public.require_event_registration_open(p_event_id);
  SELECT registration_form_version INTO current_form_version FROM public.events
  WHERE id = p_event_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Event does not exist.'; END IF;
  IF current_form_version IS DISTINCT FROM p_expected_form_version THEN
    RAISE EXCEPTION 'Event form changed; reload before submitting.';
  END IF;
  RETURN QUERY SELECT * FROM public.submit_event_registration_group(p_event_id, p_participants, p_source);
END;
$$;
REVOKE ALL ON FUNCTION public.submit_event_registration(UUID, TEXT, TEXT, INTEGER, JSONB, JSONB, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.submit_event_registration_group(UUID, JSONB, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.submit_event_registration_checked(UUID, TEXT, TEXT, INTEGER, JSONB, JSONB, UUID, TEXT, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_event_registration_checked(UUID, TEXT, TEXT, INTEGER, JSONB, JSONB, UUID, TEXT, INTEGER) TO authenticated;
REVOKE ALL ON FUNCTION public.submit_event_registration_group_checked(UUID, JSONB, TEXT, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_event_registration_group_checked(UUID, JSONB, TEXT, INTEGER) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
