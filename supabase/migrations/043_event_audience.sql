-- Activity visibility is independent of publication and registration status.
-- Existing activities remain public. Apply after 042.
BEGIN;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS audience TEXT NOT NULL DEFAULT 'all'
  CONSTRAINT events_audience_check CHECK (audience IN ('all', 'admins'));

CREATE OR REPLACE FUNCTION public.is_event_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','super_admin'));
$$;
REVOKE ALL ON FUNCTION public.is_event_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_event_admin() TO anon, authenticated;

-- Restrictive policies also constrain existing permissive policies. The
-- publication rules remain in place; being an admin is not a publish switch.
DROP POLICY IF EXISTS "Event audience visibility" ON public.events;
CREATE POLICY "Event audience visibility" ON public.events AS RESTRICTIVE
  FOR SELECT TO anon, authenticated USING (audience = 'all' OR public.is_event_admin());
DROP POLICY IF EXISTS "Registration event visibility" ON public.event_registrations;
CREATE POLICY "Registration event visibility" ON public.event_registrations AS RESTRICTIVE
  FOR SELECT TO authenticated USING (EXISTS(SELECT 1 FROM public.events e WHERE e.id = event_id));
-- Vehicle and attendee read policies already query the parent event/registration
-- under RLS, so they inherit the visibility boundary.

CREATE OR REPLACE FUNCTION public.require_event_registration_open(p_event_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE event_row public.events%ROWTYPE;
BEGIN
  SELECT * INTO event_row FROM public.events WHERE id = p_event_id FOR UPDATE;
  IF event_row.id IS NULL OR event_row.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'Event does not exist.'; END IF;
  IF event_row.audience = 'admins' AND NOT public.is_event_admin() THEN
    RAISE EXCEPTION 'This event is only available to administrators.' USING ERRCODE = '42501';
  END IF;
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

-- Keep the tested form, date, revision and capacity implementation private.
DO $wrap_save$
BEGIN
  IF to_regprocedure('public.admin_save_event_config_v040_impl(uuid,jsonb,jsonb,bigint)') IS NULL THEN
    ALTER FUNCTION public.admin_save_event_config(UUID, JSONB, JSONB, BIGINT) RENAME TO admin_save_event_config_v040_impl;
  END IF;
END;
$wrap_save$;
REVOKE ALL ON FUNCTION public.admin_save_event_config_v040_impl(UUID, JSONB, JSONB, BIGINT) FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION public.admin_save_event_config(
  p_event_id UUID, p_payload JSONB, p_vehicles JSONB, p_expected_revision BIGINT DEFAULT NULL
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE event_row public.events%ROWTYPE; requested_audience TEXT; saved_id UUID; expected_revision BIGINT := p_expected_revision;
BEGIN
  IF NOT public.has_admin_permission('events.manage') THEN RAISE EXCEPTION 'Event management permission is required.'; END IF;
  IF p_event_id IS NOT NULL THEN
    SELECT * INTO event_row FROM public.events WHERE id = p_event_id AND deleted_at IS NULL FOR UPDATE;
    IF event_row.id IS NULL THEN RAISE EXCEPTION 'Event not found.'; END IF;
    IF event_row.revision IS DISTINCT FROM p_expected_revision THEN RAISE EXCEPTION 'Event changed; reload before saving.'; END IF;
  END IF;
  -- Old clients omitting the field must never make an internal activity public.
  requested_audience := CASE WHEN p_payload ? 'audience' THEN p_payload ->> 'audience'
    ELSE COALESCE(event_row.audience, 'all') END;
  IF requested_audience IS NULL OR requested_audience NOT IN ('all','admins') THEN
    RAISE EXCEPTION 'Invalid event audience.';
  END IF;
  IF p_event_id IS NOT NULL AND event_row.audience IS DISTINCT FROM requested_audience THEN
    UPDATE public.events SET audience = requested_audience WHERE id = p_event_id RETURNING revision INTO expected_revision;
  END IF;
  saved_id := public.admin_save_event_config_v040_impl(p_event_id, p_payload, p_vehicles, expected_revision);
  IF p_event_id IS NULL AND requested_audience <> 'all' THEN
    UPDATE public.events SET audience = requested_audience WHERE id = saved_id;
  END IF;
  RETURN saved_id;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_save_event_config(UUID, JSONB, JSONB, BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_save_event_config(UUID, JSONB, JSONB, BIGINT) TO authenticated;

-- A formerly public waiter (or demoted admin) must not be auto-promoted into an
-- internal event. Keep historical registrations for administrator management.
DO $waitlist_audience$
DECLARE definition TEXT;
  anchor CONSTANT TEXT := 'WHERE event_id = p_event_id AND status = ''waitlist'' ORDER BY registered_at, id FOR UPDATE';
  replacement CONSTANT TEXT := 'WHERE event_id = p_event_id AND status = ''waitlist''
    AND (event_row.audience = ''all'' OR EXISTS(SELECT 1 FROM public.profiles p
      WHERE p.id = event_registrations.user_id AND p.role IN (''admin'',''super_admin'')))
    ORDER BY registered_at, id FOR UPDATE';
BEGIN
  SELECT pg_get_functiondef('public.promote_event_waitlist(uuid)'::regprocedure) INTO definition;
  IF position(anchor IN definition) > 0 THEN
    EXECUTE replace(definition, anchor, replacement);
  ELSIF position(replacement IN definition) = 0 THEN
    RAISE EXCEPTION 'Unexpected waitlist implementation; apply 040 before 043.';
  END IF;
END;
$waitlist_audience$;

-- Shared recipient filtering for manual sends and the scheduled worker. Private:
-- clients may only obtain recipients through the event-manager permission check.
CREATE OR REPLACE FUNCTION public.event_push_recipients_internal(p_event_id UUID)
RETURNS TABLE(token TEXT) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT DISTINCT t.token FROM public.push_tokens t JOIN public.events e ON e.id = p_event_id
  WHERE NULLIF(btrim(t.token), '') IS NOT NULL
    AND (e.audience = 'all' OR EXISTS(SELECT 1 FROM public.profiles p
      WHERE p.id = t.user_id AND p.role IN ('admin','super_admin')));
$$;
REVOKE ALL ON FUNCTION public.event_push_recipients_internal(UUID) FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION public.admin_event_push_tokens(p_event_id UUID, p_offset INTEGER DEFAULT 0, p_limit INTEGER DEFAULT 500, p_user_id UUID DEFAULT NULL)
RETURNS TABLE(token TEXT) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT public.has_admin_permission('events.manage') THEN RAISE EXCEPTION 'Event management permission is required.'; END IF;
  IF p_offset < 0 OR p_offset IS NULL OR p_limit IS NULL OR p_limit < 1 OR p_limit > 500 THEN RAISE EXCEPTION 'Invalid recipient page.'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.events WHERE id = p_event_id AND deleted_at IS NULL) THEN RAISE EXCEPTION 'Event not found.'; END IF;
  RETURN QUERY SELECT r.token FROM public.event_push_recipients_internal(p_event_id) r
    WHERE p_user_id IS NULL OR EXISTS(SELECT 1 FROM public.push_tokens t WHERE t.token = r.token AND t.user_id = p_user_id)
    ORDER BY r.token LIMIT p_limit OFFSET p_offset;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_event_push_tokens(UUID, INTEGER, INTEGER, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_event_push_tokens(UUID, INTEGER, INTEGER, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.claim_event_registration_notification(p_job_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE event_row public.events%ROWTYPE; job_row public.event_registration_notification_jobs%ROWTYPE;
  target_event UUID; claim_token UUID; tokens JSONB;
BEGIN
  SELECT event_id INTO target_event FROM public.event_registration_notification_jobs WHERE id = p_job_id;
  IF target_event IS NULL THEN RETURN jsonb_build_object('claimed', FALSE); END IF;
  SELECT * INTO event_row FROM public.events WHERE id = target_event FOR UPDATE;
  SELECT * INTO job_row FROM public.event_registration_notification_jobs WHERE id = p_job_id FOR UPDATE;
  IF job_row.status NOT IN ('pending', 'processing') OR (job_row.lease_until > clock_timestamp()) THEN
    RETURN jsonb_build_object('claimed', FALSE, 'status', job_row.status);
  END IF;
  IF NOT event_row.is_published OR event_row.deleted_at IS NOT NULL OR event_row.registration_status <> 'open'
     OR NOT event_row.registration_start_notify_enabled OR event_row.registration_start_at IS DISTINCT FROM job_row.scheduled_for
     OR clock_timestamp() < job_row.scheduled_for OR clock_timestamp() > event_row.end_time
     OR (event_row.registration_deadline IS NOT NULL AND clock_timestamp() > event_row.registration_deadline) THEN
    RETURN jsonb_build_object('claimed', FALSE, 'status', 'not_available');
  END IF;
  -- Re-check membership on retries as an administrator may have been demoted.
  DELETE FROM public.event_registration_notification_targets t WHERE t.job_id = p_job_id AND t.status = 'pending'
    AND NOT EXISTS(SELECT 1 FROM public.event_push_recipients_internal(target_event) r WHERE r.token = t.token);
  IF NOT job_row.targets_initialized THEN
    INSERT INTO public.event_registration_notification_targets(job_id, token)
    SELECT p_job_id, r.token FROM public.event_push_recipients_internal(target_event) r ON CONFLICT DO NOTHING;
  END IF;
  claim_token := gen_random_uuid();
  UPDATE public.event_registration_notification_jobs SET status = 'processing', targets_initialized = TRUE,
    attempts = greatest(attempts, 1), lease_token = claim_token, lease_until = clock_timestamp() + interval '3 minutes',
    updated_at = now() WHERE id = p_job_id;
  SELECT COALESCE(jsonb_agg(token ORDER BY token), '[]'::JSONB) INTO tokens
  FROM public.event_registration_notification_targets WHERE job_id = p_job_id AND status = 'pending';
  RETURN jsonb_build_object('claimed', TRUE, 'lease_token', claim_token, 'event_id', target_event,
    'title', event_row.title, 'tokens', tokens);
END;
$$;
REVOKE ALL ON FUNCTION public.claim_event_registration_notification(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_event_registration_notification(UUID) TO service_role;

-- Invalidate a worker's old recipient snapshot when the audience changes.
-- Already accepted notifications cannot be recalled; sent tickets stay recorded.
CREATE OR REPLACE FUNCTION public.sync_event_registration_notification_job()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.audience IS DISTINCT FROM NEW.audience THEN
    DELETE FROM public.event_registration_notification_targets t USING public.event_registration_notification_jobs j
    WHERE t.job_id = j.id AND j.event_id = NEW.id AND j.status IN ('pending','processing','cancelled') AND t.status <> 'sent';
    UPDATE public.event_registration_notification_jobs SET status = 'pending', targets_initialized = FALSE,
      lease_token = NULL, lease_until = NULL, next_attempt_at = NULL, failed_count = 0, updated_at = now()
    WHERE event_id = NEW.id AND status IN ('pending','processing','cancelled');
  END IF;
  PERFORM public.schedule_event_registration_notification_internal(NEW.id);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.sync_event_registration_notification_job() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS events_registration_notification_schedule ON public.events;
CREATE TRIGGER events_registration_notification_schedule
AFTER INSERT OR UPDATE OF is_published, registration_status, registration_start_at,
  registration_start_notify_enabled, registration_deadline, end_time, deleted_at, audience ON public.events
FOR EACH ROW EXECUTE FUNCTION public.sync_event_registration_notification_job();

NOTIFY pgrst, 'reload schema';
COMMIT;
