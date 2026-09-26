-- Keep capacity, vehicle assignment, event configuration, and exports consistent.

CREATE OR REPLACE FUNCTION public.validate_event_registration_answers(p_event_id UUID, p_answers JSONB)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE field JSONB; field_key TEXT; field_type TEXT; answer JSONB; value_text TEXT;
BEGIN
  IF p_answers IS NULL OR jsonb_typeof(p_answers) <> 'object' THEN
    RAISE EXCEPTION 'Registration answers must be an object.';
  END IF;
  FOR field IN SELECT value FROM jsonb_array_elements(
    COALESCE((SELECT registration_form FROM public.events WHERE id = p_event_id), '[]'::jsonb)
  ) AS fields(value) LOOP
    field_key := NULLIF(field ->> 'key', '');
    IF field_key IS NULL OR (field ->> 'system') = 'true' THEN CONTINUE; END IF;
    field_type := COALESCE(field ->> 'type', 'text');
    answer := p_answers -> field_key;
    IF answer IS NULL OR answer = 'null'::jsonb
       OR (jsonb_typeof(answer) = 'string' AND btrim(answer #>> '{}') = '')
       OR (jsonb_typeof(answer) = 'array' AND jsonb_array_length(answer) = 0)
       OR (field_type = 'checkbox' AND answer = 'false'::jsonb) THEN
      IF (field ->> 'required') = 'true' THEN
        RAISE EXCEPTION 'Required registration field is missing: %', field_key;
      END IF;
      CONTINUE;
    END IF;
    value_text := CASE WHEN jsonb_typeof(answer) = 'string' THEN answer #>> '{}' ELSE NULL END;
    IF field_type = 'email' AND (value_text IS NULL OR value_text !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$') THEN
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
      SELECT 1 FROM jsonb_array_elements_text(COALESCE(field -> 'options', '[]'::jsonb)) AS choices(choice)
      WHERE choices.choice = value_text)) THEN
      RAISE EXCEPTION 'Invalid selection for field: %', field_key;
    ELSIF field_type = 'multiselect' THEN
      IF jsonb_typeof(answer) <> 'array' THEN
        RAISE EXCEPTION 'Invalid selection for field: %', field_key;
      END IF;
      IF EXISTS (SELECT 1 FROM jsonb_array_elements(answer) AS selected(item)
        WHERE jsonb_typeof(selected.item) <> 'string' OR NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(COALESCE(field -> 'options', '[]'::jsonb)) AS choices(choice)
          WHERE choices.choice = (selected.item #>> '{}')
        )) THEN
        RAISE EXCEPTION 'Invalid selection for field: %', field_key;
      END IF;
    ELSIF field_type = 'checkbox' AND jsonb_typeof(answer) <> 'boolean' THEN
      RAISE EXCEPTION 'Invalid checkbox value for field: %', field_key;
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_event_attendee_contact()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.email IS NOT NULL AND NEW.email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
    RAISE EXCEPTION 'Invalid attendee email.';
  END IF;
  IF NEW.phone IS NOT NULL AND (NEW.phone !~ '^\+?[0-9 ()-]{5,30}$'
    OR length(regexp_replace(NEW.phone, '[^0-9]', '', 'g')) < 5) THEN
    RAISE EXCEPTION 'Invalid attendee phone.';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS event_attendee_contact_guard ON public.event_registration_attendees;
CREATE TRIGGER event_attendee_contact_guard
BEFORE INSERT OR UPDATE OF email, phone ON public.event_registration_attendees
FOR EACH ROW EXECUTE FUNCTION public.validate_event_attendee_contact();

ALTER TABLE public.event_registrations
  ADD COLUMN IF NOT EXISTS requested_vehicle_id UUID REFERENCES public.event_vehicles(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.submit_event_registration(
  p_event_id UUID,
  p_registration_kind TEXT DEFAULT 'self',
  p_proxy_note TEXT DEFAULT NULL,
  p_participant_count INTEGER DEFAULT 1,
  p_answers JSONB DEFAULT '{}'::jsonb,
  p_attendees JSONB DEFAULT '[]'::jsonb,
  p_vehicle_id UUID DEFAULT NULL,
  p_source TEXT DEFAULT 'app'
)
RETURNS TABLE (
  registration_id UUID,
  registration_status TEXT,
  assigned_vehicle_id UUID,
  participant_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  caller_id UUID := auth.uid();
  event_row public.events%ROWTYPE;
  vehicle_row public.event_vehicles%ROWTYPE;
  selected_vehicle UUID := p_vehicle_id;
  current_confirmed INTEGER;
  vehicle_confirmed INTEGER;
  result_status TEXT := 'confirmed';
  new_registration_id UUID;
  attendee JSONB;
  attendee_name TEXT;
BEGIN
  IF caller_id IS NULL THEN RAISE EXCEPTION 'Authentication is required to register.'; END IF;
  IF p_registration_kind NOT IN ('self', 'proxy') THEN RAISE EXCEPTION 'Invalid registration kind.'; END IF;
  IF p_participant_count < 1 OR p_participant_count > 100 THEN
    RAISE EXCEPTION 'Participant count must be between 1 and 100.';
  END IF;
  IF p_registration_kind = 'proxy'
     AND (NOT EXISTS (SELECT 1 FROM public.events WHERE id = p_event_id AND allow_proxy_registration)
          OR NULLIF(btrim(COALESCE(p_proxy_note, '')), '') IS NULL) THEN
    RAISE EXCEPTION 'This event does not allow proxy registration or the proxy note is missing.';
  END IF;
  IF jsonb_typeof(COALESCE(p_attendees, '[]'::jsonb)) <> 'array'
     OR jsonb_array_length(COALESCE(p_attendees, '[]'::jsonb)) <> p_participant_count THEN
    RAISE EXCEPTION 'Provide one attendee name for each participant.';
  END IF;

  -- Every registration for an event takes this lock before counting capacity.
  SELECT * INTO event_row FROM public.events
  WHERE id = p_event_id AND deleted_at IS NULL FOR UPDATE;
  IF event_row.id IS NULL THEN RAISE EXCEPTION 'Event does not exist.'; END IF;
  IF p_registration_kind = 'proxy' AND NOT event_row.allow_proxy_registration THEN
    RAISE EXCEPTION 'This event does not allow proxy registration.';
  END IF;
  IF NOT event_row.is_published OR event_row.registration_status <> 'open' THEN
    RAISE EXCEPTION 'Registration is not open for this event.';
  END IF;
  IF event_row.registration_start_at IS NOT NULL AND now() < event_row.registration_start_at THEN
    RAISE EXCEPTION 'Registration has not opened yet.';
  END IF;
  IF event_row.registration_deadline IS NOT NULL AND now() > event_row.registration_deadline THEN
    RAISE EXCEPTION 'Registration deadline has passed.';
  END IF;
  IF now() > event_row.end_time THEN RAISE EXCEPTION 'This event has already ended.'; END IF;

  PERFORM public.validate_event_registration_answers(p_event_id, COALESCE(p_answers, '{}'::jsonb));
  FOR attendee IN SELECT value FROM jsonb_array_elements(p_attendees) LOOP
    attendee_name := NULLIF(btrim(COALESCE(attendee ->> 'name', '')), '');
    IF attendee_name IS NULL OR length(attendee_name) > 200 THEN
      RAISE EXCEPTION 'Each attendee needs a valid name.';
    END IF;
  END LOOP;
  IF p_registration_kind = 'self' AND EXISTS (
    SELECT 1 FROM public.event_registrations
    WHERE event_id = p_event_id AND user_id = caller_id
      AND registration_kind = 'self' AND status <> 'cancelled'
  ) THEN RAISE EXCEPTION 'You already have an active registration for this event.'; END IF;

  SELECT COALESCE(sum(r.participant_count), 0)::INTEGER INTO current_confirmed
  FROM public.event_registrations r
  WHERE r.event_id = p_event_id AND r.status = 'confirmed';
  IF event_row.max_participants IS NOT NULL
     AND current_confirmed + p_participant_count > event_row.max_participants THEN
    result_status := CASE WHEN event_row.allow_waitlist THEN 'waitlist' ELSE 'full' END;
  END IF;

  IF result_status = 'waitlist' AND event_row.vehicle_selection_mode = 'self_select' THEN
    IF selected_vehicle IS NULL THEN RAISE EXCEPTION 'Please select a vehicle.'; END IF;
    PERFORM 1 FROM public.event_vehicles
    WHERE id = selected_vehicle AND event_id = p_event_id AND is_active FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Selected vehicle is unavailable.'; END IF;
  END IF;

  IF result_status = 'confirmed' AND event_row.vehicle_selection_mode <> 'none' THEN
    IF event_row.vehicle_selection_mode = 'self_select' THEN
      IF selected_vehicle IS NULL THEN RAISE EXCEPTION 'Please select a vehicle.'; END IF;
      SELECT * INTO vehicle_row FROM public.event_vehicles
      WHERE id = selected_vehicle AND event_id = p_event_id AND is_active FOR UPDATE;
      IF vehicle_row.id IS NULL THEN RAISE EXCEPTION 'Selected vehicle is unavailable.'; END IF;
      SELECT COALESCE(sum(r.participant_count), 0)::INTEGER INTO vehicle_confirmed
      FROM public.event_registrations r
      WHERE r.vehicle_id = vehicle_row.id AND r.status = 'confirmed';
      IF vehicle_confirmed + p_participant_count > vehicle_row.capacity - vehicle_row.reserved_seats THEN
        RAISE EXCEPTION 'The selected vehicle no longer has enough seats.';
      END IF;
    ELSIF event_row.vehicle_selection_mode = 'auto' THEN
      selected_vehicle := NULL;
      FOR vehicle_row IN SELECT * FROM public.event_vehicles
        WHERE event_id = p_event_id AND is_active ORDER BY sort_order, name, id FOR UPDATE
      LOOP
        SELECT COALESCE(sum(r.participant_count), 0)::INTEGER INTO vehicle_confirmed
        FROM public.event_registrations r
        WHERE r.vehicle_id = vehicle_row.id AND r.status = 'confirmed';
        IF vehicle_confirmed + p_participant_count <= vehicle_row.capacity - vehicle_row.reserved_seats THEN
          selected_vehicle := vehicle_row.id;
          EXIT;
        END IF;
      END LOOP;
      IF selected_vehicle IS NULL THEN
        result_status := CASE WHEN event_row.allow_waitlist THEN 'waitlist' ELSE 'full' END;
      END IF;
    ELSE
      selected_vehicle := NULL;
    END IF;
  END IF;
  IF result_status = 'full' THEN RAISE EXCEPTION 'This event is full.'; END IF;
  IF result_status = 'waitlist' OR event_row.vehicle_selection_mode IN ('none', 'admin') THEN
    selected_vehicle := NULL;
  END IF;

  INSERT INTO public.event_registrations (
    event_id, user_id, registered_at, status, registration_kind, proxy_note,
    participant_count, answers, form_version, vehicle_id, requested_vehicle_id,
    source, registration_number, updated_at
  ) VALUES (
    p_event_id, caller_id, now(), result_status, p_registration_kind,
    CASE WHEN p_registration_kind = 'proxy' THEN NULLIF(btrim(p_proxy_note), '') ELSE NULL END,
    p_participant_count, COALESCE(p_answers, '{}'::jsonb), event_row.registration_form_version,
    selected_vehicle, CASE WHEN event_row.vehicle_selection_mode = 'self_select' THEN p_vehicle_id ELSE NULL END,
    COALESCE(NULLIF(p_source, ''), 'app'),
    upper(substr(replace(gen_random_uuid()::TEXT, '-', ''), 1, 10)), now()
  ) RETURNING id INTO new_registration_id;

  INSERT INTO public.event_registration_attendees (registration_id, name, phone, email, sort_order)
  SELECT new_registration_id, btrim(item ->> 'name'), NULLIF(btrim(item ->> 'phone'), ''),
         NULLIF(lower(btrim(item ->> 'email')), ''), ordinality::INTEGER - 1
  FROM jsonb_array_elements(p_attendees) WITH ORDINALITY AS items(item, ordinality);
  INSERT INTO public.event_registration_audit_logs (event_id, registration_id, actor_id, action, details)
  VALUES (p_event_id, new_registration_id, caller_id, 'created',
          jsonb_build_object('kind', p_registration_kind, 'participant_count', p_participant_count, 'status', result_status));
  RETURN QUERY SELECT new_registration_id, result_status, selected_vehicle, p_participant_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_assign_event_registration(
  p_registration_id UUID, p_vehicle_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  reg_row public.event_registrations%ROWTYPE;
  event_row public.events%ROWTYPE;
  vehicle_row public.event_vehicles%ROWTYPE;
  used_seats INTEGER;
  confirmed_count INTEGER;
  target_event_id UUID;
  caller_id UUID := auth.uid();
BEGIN
  IF NOT public.has_admin_permission('events.manage') THEN
    RAISE EXCEPTION 'Event management permission is required.';
  END IF;
  SELECT event_id INTO target_event_id FROM public.event_registrations WHERE id = p_registration_id;
  IF target_event_id IS NULL THEN RAISE EXCEPTION 'Registration not found.'; END IF;
  SELECT * INTO event_row FROM public.events WHERE id = target_event_id FOR UPDATE;
  SELECT * INTO reg_row FROM public.event_registrations WHERE id = p_registration_id FOR UPDATE;
  IF reg_row.id IS NULL THEN RAISE EXCEPTION 'Registration not found.'; END IF;
  IF reg_row.status = 'cancelled' THEN RAISE EXCEPTION 'Cancelled registrations cannot be assigned.'; END IF;

  IF p_vehicle_id IS NULL THEN
    IF NOT event_row.allow_waitlist THEN
      RAISE EXCEPTION 'This event does not allow unassigned waitlist entries.';
    END IF;
    UPDATE public.event_registrations SET vehicle_id = NULL, status = 'waitlist', updated_at = now()
    WHERE id = p_registration_id;
  ELSE
    SELECT * INTO vehicle_row FROM public.event_vehicles
    WHERE id = p_vehicle_id AND event_id = reg_row.event_id AND is_active FOR UPDATE;
    IF vehicle_row.id IS NULL THEN RAISE EXCEPTION 'Vehicle is unavailable.'; END IF;
    SELECT COALESCE(sum(r.participant_count), 0)::INTEGER INTO confirmed_count
    FROM public.event_registrations r
    WHERE r.event_id = reg_row.event_id AND r.status = 'confirmed' AND r.id <> reg_row.id;
    IF event_row.max_participants IS NOT NULL
       AND confirmed_count + reg_row.participant_count > event_row.max_participants THEN
      RAISE EXCEPTION 'This event is full.';
    END IF;
    SELECT COALESCE(sum(r.participant_count), 0)::INTEGER INTO used_seats
    FROM public.event_registrations r
    WHERE r.vehicle_id = p_vehicle_id AND r.status = 'confirmed' AND r.id <> reg_row.id;
    IF used_seats + reg_row.participant_count > vehicle_row.capacity - vehicle_row.reserved_seats THEN
      RAISE EXCEPTION 'The vehicle does not have enough seats.';
    END IF;
    UPDATE public.event_registrations SET vehicle_id = p_vehicle_id, status = 'confirmed', updated_at = now()
    WHERE id = p_registration_id;
  END IF;
  INSERT INTO public.event_registration_audit_logs (event_id, registration_id, actor_id, action, details)
  VALUES (reg_row.event_id, reg_row.id, caller_id, 'vehicle_assigned',
          jsonb_build_object('vehicle_id', p_vehicle_id));
  IF p_vehicle_id IS NOT NULL THEN
    PERFORM public.promote_event_waitlist(reg_row.event_id);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_event_vehicle_capacity()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE occupied INTEGER;
BEGIN
  SELECT COALESCE(sum(participant_count), 0)::INTEGER INTO occupied
  FROM public.event_registrations WHERE vehicle_id = NEW.id AND status = 'confirmed';
  IF occupied > 0 AND NOT NEW.is_active THEN
    RAISE EXCEPTION 'Cannot deactivate a vehicle with confirmed passengers.';
  END IF;
  IF occupied > NEW.capacity - NEW.reserved_seats THEN
    RAISE EXCEPTION 'Vehicle capacity is below its confirmed passenger count.';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS event_vehicle_capacity_guard ON public.event_vehicles;
CREATE TRIGGER event_vehicle_capacity_guard
BEFORE UPDATE OF capacity, reserved_seats, is_active ON public.event_vehicles
FOR EACH ROW EXECUTE FUNCTION public.check_event_vehicle_capacity();

CREATE OR REPLACE FUNCTION public.check_event_max_participants()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE confirmed_count INTEGER;
BEGIN
  IF NEW.max_participants IS NOT NULL THEN
    SELECT COALESCE(sum(participant_count), 0)::INTEGER INTO confirmed_count
    FROM public.event_registrations WHERE event_id = NEW.id AND status = 'confirmed';
    IF confirmed_count > NEW.max_participants THEN
      RAISE EXCEPTION 'Event capacity is below its confirmed registration count.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS event_max_participants_guard ON public.events;
CREATE TRIGGER event_max_participants_guard
BEFORE UPDATE OF max_participants ON public.events
FOR EACH ROW EXECUTE FUNCTION public.check_event_max_participants();

-- Event and vehicle edits commit together, so a published event cannot appear
-- with only some of its vehicles after a network interruption.
CREATE OR REPLACE FUNCTION public.admin_save_event_config(
  p_event_id UUID, p_payload JSONB, p_vehicles JSONB
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  saved_id UUID := p_event_id;
  vehicle JSONB;
  vehicle_id UUID;
  seen_ids UUID[] := '{}'::UUID[];
  confirmed_count INTEGER;
  saved_row public.events%ROWTYPE;
BEGIN
  IF NOT public.has_admin_permission('events.manage') THEN
    RAISE EXCEPTION 'Event management permission is required.';
  END IF;
  IF jsonb_typeof(p_payload) <> 'object' OR jsonb_typeof(p_vehicles) <> 'array' THEN
    RAISE EXCEPTION 'Invalid event configuration.';
  END IF;
  IF NULLIF(btrim(COALESCE(p_payload ->> 'title', '')), '') IS NULL
     OR NULLIF(btrim(COALESCE(p_payload ->> 'description', '')), '') IS NULL THEN
    RAISE EXCEPTION 'Event title and details are required.';
  END IF;
  IF (p_payload ->> 'start_time')::TIMESTAMPTZ IS NULL
     OR (p_payload ->> 'end_time')::TIMESTAMPTZ IS NULL
     OR (p_payload ->> 'end_time')::TIMESTAMPTZ < (p_payload ->> 'start_time')::TIMESTAMPTZ THEN
    RAISE EXCEPTION 'Event dates are invalid.';
  END IF;
  IF (p_payload ->> 'max_participants')::INTEGER IS NOT NULL
     AND (p_payload ->> 'max_participants')::INTEGER < 1 THEN
    RAISE EXCEPTION 'Event capacity must be positive.';
  END IF;
  IF jsonb_typeof(COALESCE(p_payload -> 'registration_form', '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'Event form must be a list of fields.';
  END IF;
  IF (p_payload ->> 'registration_start_at')::TIMESTAMPTZ IS NOT NULL
     AND (p_payload ->> 'registration_deadline')::TIMESTAMPTZ IS NOT NULL
     AND (p_payload ->> 'registration_deadline')::TIMESTAMPTZ < (p_payload ->> 'registration_start_at')::TIMESTAMPTZ THEN
    RAISE EXCEPTION 'Registration deadline is before opening time.';
  END IF;
  IF (p_payload ->> 'registration_start_at')::TIMESTAMPTZ > (p_payload ->> 'end_time')::TIMESTAMPTZ
     OR (p_payload ->> 'registration_deadline')::TIMESTAMPTZ > (p_payload ->> 'end_time')::TIMESTAMPTZ THEN
    RAISE EXCEPTION 'Registration time is after the event ends.';
  END IF;

  IF saved_id IS NULL THEN
    INSERT INTO public.events (title, description, location, start_time, end_time,
      has_end_date, start_has_time, end_has_time, registration_deadline,
      registration_start_at, registration_start_notify_enabled, max_participants,
      is_published, registration_status, registration_mode, registration_form,
      registration_form_version, vehicle_selection_mode, allow_proxy_registration,
      allow_waitlist, updated_at)
    VALUES (btrim(p_payload ->> 'title'), btrim(p_payload ->> 'description'),
      NULLIF(p_payload ->> 'location', ''), (p_payload ->> 'start_time')::TIMESTAMPTZ,
      (p_payload ->> 'end_time')::TIMESTAMPTZ,
      COALESCE((p_payload ->> 'has_end_date')::BOOLEAN, TRUE),
      COALESCE((p_payload ->> 'start_has_time')::BOOLEAN, TRUE),
      COALESCE((p_payload ->> 'end_has_time')::BOOLEAN, TRUE),
      (p_payload ->> 'registration_deadline')::TIMESTAMPTZ,
      (p_payload ->> 'registration_start_at')::TIMESTAMPTZ,
      COALESCE((p_payload ->> 'registration_start_notify_enabled')::BOOLEAN, FALSE),
      (p_payload ->> 'max_participants')::INTEGER,
      COALESCE((p_payload ->> 'is_published')::BOOLEAN, FALSE),
      COALESCE(p_payload ->> 'registration_status', 'draft'), 'authenticated',
      COALESCE(p_payload -> 'registration_form', '[]'::JSONB), 1,
      COALESCE(p_payload ->> 'vehicle_selection_mode', 'none'),
      COALESCE((p_payload ->> 'allow_proxy_registration')::BOOLEAN, FALSE),
      COALESCE((p_payload ->> 'allow_waitlist')::BOOLEAN, TRUE), now())
    RETURNING id INTO saved_id;
  ELSE
    SELECT * INTO saved_row FROM public.events WHERE id = saved_id AND deleted_at IS NULL FOR UPDATE;
    IF saved_row.id IS NULL THEN RAISE EXCEPTION 'Event not found.'; END IF;
    SELECT COALESCE(sum(participant_count), 0)::INTEGER INTO confirmed_count
    FROM public.event_registrations WHERE event_id = saved_id AND status = 'confirmed';
    IF (p_payload ->> 'max_participants')::INTEGER IS NOT NULL
       AND confirmed_count > (p_payload ->> 'max_participants')::INTEGER THEN
      RAISE EXCEPTION 'Event capacity is below its confirmed registration count.';
    END IF;
    UPDATE public.events SET
      title = btrim(p_payload ->> 'title'), description = btrim(p_payload ->> 'description'),
      location = NULLIF(p_payload ->> 'location', ''),
      start_time = (p_payload ->> 'start_time')::TIMESTAMPTZ,
      end_time = (p_payload ->> 'end_time')::TIMESTAMPTZ,
      has_end_date = COALESCE((p_payload ->> 'has_end_date')::BOOLEAN, TRUE),
      start_has_time = COALESCE((p_payload ->> 'start_has_time')::BOOLEAN, TRUE),
      end_has_time = COALESCE((p_payload ->> 'end_has_time')::BOOLEAN, TRUE),
      registration_deadline = (p_payload ->> 'registration_deadline')::TIMESTAMPTZ,
      registration_start_at = (p_payload ->> 'registration_start_at')::TIMESTAMPTZ,
      registration_start_notify_enabled = COALESCE((p_payload ->> 'registration_start_notify_enabled')::BOOLEAN, FALSE),
      max_participants = (p_payload ->> 'max_participants')::INTEGER,
      is_published = COALESCE((p_payload ->> 'is_published')::BOOLEAN, FALSE),
      registration_status = COALESCE(p_payload ->> 'registration_status', 'draft'),
      registration_mode = 'authenticated',
      registration_form = COALESCE(p_payload -> 'registration_form', '[]'::JSONB),
      registration_form_version = saved_row.registration_form_version + 1,
      vehicle_selection_mode = COALESCE(p_payload ->> 'vehicle_selection_mode', 'none'),
      allow_proxy_registration = COALESCE((p_payload ->> 'allow_proxy_registration')::BOOLEAN, FALSE),
      allow_waitlist = COALESCE((p_payload ->> 'allow_waitlist')::BOOLEAN, TRUE),
      updated_at = now()
    WHERE id = saved_id;
  END IF;

  FOR vehicle IN SELECT value FROM jsonb_array_elements(p_vehicles) LOOP
    vehicle_id := NULLIF(vehicle ->> 'id', '')::UUID;
    IF vehicle_id IS NOT NULL AND vehicle_id = ANY(seen_ids) THEN
      RAISE EXCEPTION 'Duplicate vehicle in event configuration.';
    END IF;
    IF NULLIF(btrim(COALESCE(vehicle ->> 'name', '')), '') IS NULL THEN
      RAISE EXCEPTION 'Vehicle name is required.';
    END IF;
    IF vehicle_id IS NULL THEN
      INSERT INTO public.event_vehicles (event_id, name, capacity, reserved_seats,
        boarding_stop, departure_time, notes, sort_order, is_active)
      VALUES (saved_id, btrim(vehicle ->> 'name'), (vehicle ->> 'capacity')::INTEGER,
        COALESCE((vehicle ->> 'reserved_seats')::INTEGER, 0),
        NULLIF(vehicle ->> 'boarding_stop', ''), NULLIF(vehicle ->> 'departure_time', ''),
        NULLIF(vehicle ->> 'notes', ''), COALESCE((vehicle ->> 'sort_order')::INTEGER, 0),
        COALESCE((vehicle ->> 'is_active')::BOOLEAN, TRUE))
      RETURNING id INTO vehicle_id;
    ELSE
      UPDATE public.event_vehicles SET name = btrim(vehicle ->> 'name'),
        capacity = (vehicle ->> 'capacity')::INTEGER,
        reserved_seats = COALESCE((vehicle ->> 'reserved_seats')::INTEGER, 0),
        boarding_stop = NULLIF(vehicle ->> 'boarding_stop', ''),
        departure_time = NULLIF(vehicle ->> 'departure_time', ''),
        notes = NULLIF(vehicle ->> 'notes', ''),
        sort_order = COALESCE((vehicle ->> 'sort_order')::INTEGER, 0),
        is_active = COALESCE((vehicle ->> 'is_active')::BOOLEAN, TRUE), updated_at = now()
      WHERE id = vehicle_id AND event_id = saved_id;
      IF NOT FOUND THEN RAISE EXCEPTION 'Vehicle does not belong to this event.'; END IF;
    END IF;
    seen_ids := array_append(seen_ids, vehicle_id);
  END LOOP;
  UPDATE public.event_vehicles SET is_active = FALSE, updated_at = now()
  WHERE event_id = saved_id AND NOT (id = ANY(seen_ids)) AND is_active;
  IF COALESCE(p_payload ->> 'vehicle_selection_mode', 'none') <> 'none'
     AND COALESCE((p_payload ->> 'is_published')::BOOLEAN, FALSE)
     AND COALESCE(p_payload ->> 'registration_status', 'draft') = 'open'
     AND NOT EXISTS (SELECT 1 FROM public.event_vehicles WHERE event_id = saved_id AND is_active) THEN
    RAISE EXCEPTION 'Published registration requires an active vehicle.';
  END IF;
  RETURN saved_id;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_save_event_config(UUID, JSONB, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_save_event_config(UUID, JSONB, JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_update_event_registration_full(
  p_registration_id UUID, p_name TEXT, p_phone TEXT, p_email TEXT,
  p_answers JSONB, p_proxy_note TEXT, p_vehicle_id UUID, p_notify BOOLEAN DEFAULT FALSE
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  target_event_id UUID;
  reg_row public.event_registrations%ROWTYPE;
BEGIN
  IF NOT public.has_admin_permission('events.manage') THEN
    RAISE EXCEPTION 'Event management permission is required.';
  END IF;
  SELECT event_id INTO target_event_id FROM public.event_registrations WHERE id = p_registration_id;
  IF target_event_id IS NULL THEN RAISE EXCEPTION 'Registration not found.'; END IF;
  PERFORM 1 FROM public.events WHERE id = target_event_id FOR UPDATE;
  SELECT * INTO reg_row FROM public.event_registrations WHERE id = p_registration_id FOR UPDATE;
  IF reg_row.status = 'cancelled' THEN RAISE EXCEPTION 'Cancelled registrations cannot be edited.'; END IF;
  IF reg_row.registration_kind = 'proxy' AND NULLIF(btrim(COALESCE(p_proxy_note, '')), '') IS NULL THEN
    RAISE EXCEPTION 'The proxy note is required.';
  END IF;
  PERFORM public.admin_update_event_registration(
    p_registration_id, p_name, p_phone, p_email, p_answers, p_notify
  );
  IF reg_row.registration_kind = 'proxy' THEN
    UPDATE public.event_registrations SET proxy_note = btrim(p_proxy_note) WHERE id = p_registration_id;
  END IF;
  IF p_vehicle_id IS DISTINCT FROM reg_row.vehicle_id THEN
    PERFORM public.admin_assign_event_registration(p_registration_id, p_vehicle_id);
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_update_event_registration_full(UUID, TEXT, TEXT, TEXT, JSONB, TEXT, UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_event_registration_full(UUID, TEXT, TEXT, TEXT, JSONB, TEXT, UUID, BOOLEAN) TO authenticated;

-- One database snapshot for exporting a roster during active registration.
CREATE OR REPLACE FUNCTION public.admin_event_registration_snapshot(p_event_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE result JSONB;
BEGIN
  IF NOT public.has_admin_permission('events.manage') THEN
    RAISE EXCEPTION 'Event management permission is required.';
  END IF;
  SELECT jsonb_build_object(
    'event', to_jsonb(e),
    'vehicles', COALESCE((SELECT jsonb_agg(to_jsonb(v) ORDER BY v.sort_order, v.id)
      FROM public.event_vehicles v WHERE v.event_id = e.id), '[]'::JSONB),
    'registrations', COALESCE((SELECT jsonb_agg(
      to_jsonb(r) || jsonb_build_object('attendees', COALESCE((
        SELECT jsonb_agg(to_jsonb(a) ORDER BY a.sort_order, a.id)
        FROM public.event_registration_attendees a WHERE a.registration_id = r.id
      ), '[]'::JSONB)) ORDER BY r.registered_at, r.id)
      FROM public.event_registrations r WHERE r.event_id = e.id), '[]'::JSONB)
  ) INTO result FROM public.events e WHERE e.id = p_event_id;
  IF result IS NULL THEN RAISE EXCEPTION 'Event not found.'; END IF;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_event_registration_snapshot(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_event_registration_snapshot(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.promote_event_waitlist(p_event_id UUID)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  event_row public.events%ROWTYPE;
  reg_row public.event_registrations%ROWTYPE;
  vehicle_row public.event_vehicles%ROWTYPE;
  assigned_vehicle UUID;
  confirmed_count INTEGER;
  occupied INTEGER;
  promoted INTEGER := 0;
BEGIN
  SELECT * INTO event_row FROM public.events WHERE id = p_event_id FOR UPDATE;
  IF event_row.id IS NULL OR event_row.deleted_at IS NOT NULL OR NOT event_row.is_published
     OR event_row.registration_status <> 'open'
     OR (event_row.registration_start_at IS NOT NULL AND now() < event_row.registration_start_at)
     OR (event_row.registration_deadline IS NOT NULL AND now() > event_row.registration_deadline)
     OR now() > event_row.end_time THEN
    RETURN 0;
  END IF;

  FOR reg_row IN SELECT * FROM public.event_registrations
    WHERE event_id = p_event_id AND status = 'waitlist'
    ORDER BY registered_at, id FOR UPDATE
  LOOP
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
          assigned_vehicle := vehicle_row.id;
          EXIT;
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

-- A failed earlier run may have renamed the old function before stopping.
-- Revoke that unused helper while restoring the public RPC below.
DO $old_update$
BEGIN
  IF to_regprocedure('public.update_event_registration_locked_impl(uuid,text,integer,jsonb,jsonb,uuid)') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.update_event_registration_locked_impl(uuid,text,integer,jsonb,jsonb,uuid) FROM PUBLIC, authenticated';
  END IF;
END;
$old_update$;
CREATE OR REPLACE FUNCTION public.update_event_registration(
  p_registration_id UUID, p_proxy_note TEXT DEFAULT NULL, p_participant_count INTEGER DEFAULT 1,
  p_answers JSONB DEFAULT '{}'::jsonb, p_attendees JSONB DEFAULT '[]'::jsonb,
  p_vehicle_id UUID DEFAULT NULL
)
RETURNS TABLE (registration_id UUID, registration_status TEXT, assigned_vehicle_id UUID, participant_count INTEGER)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  caller_id UUID := auth.uid();
  target_event_id UUID;
  reg_row public.event_registrations%ROWTYPE;
  event_row public.events%ROWTYPE;
  vehicle_row public.event_vehicles%ROWTYPE;
  selected_vehicle UUID;
  requested_vehicle UUID;
  used_seats INTEGER;
  result_status TEXT := 'confirmed';
  attendee JSONB;
  attendee_name TEXT;
BEGIN
  IF caller_id IS NULL THEN RAISE EXCEPTION 'Authentication is required.'; END IF;
  IF p_participant_count < 1 OR p_participant_count > 100 THEN
    RAISE EXCEPTION 'Participant count must be between 1 and 100.';
  END IF;
  IF jsonb_typeof(COALESCE(p_attendees, '[]'::jsonb)) <> 'array'
     OR jsonb_array_length(COALESCE(p_attendees, '[]'::jsonb)) <> p_participant_count THEN
    RAISE EXCEPTION 'Provide one attendee name for each participant.';
  END IF;
  SELECT r.event_id INTO target_event_id FROM public.event_registrations r
  WHERE r.id = p_registration_id AND r.user_id = caller_id;
  IF target_event_id IS NULL THEN RAISE EXCEPTION 'Registration not found.'; END IF;
  SELECT * INTO event_row FROM public.events e WHERE e.id = target_event_id AND e.deleted_at IS NULL FOR UPDATE;
  SELECT * INTO reg_row FROM public.event_registrations r
  WHERE r.id = p_registration_id AND r.user_id = caller_id FOR UPDATE;
  IF reg_row.id IS NULL THEN RAISE EXCEPTION 'Registration not found.'; END IF;
  IF reg_row.status = 'cancelled' THEN RAISE EXCEPTION 'Cancelled registrations cannot be edited.'; END IF;
  IF event_row.id IS NULL OR event_row.registration_status <> 'open' THEN
    RAISE EXCEPTION 'This event is no longer accepting changes.';
  END IF;
  IF event_row.registration_deadline IS NOT NULL AND now() > event_row.registration_deadline THEN
    RAISE EXCEPTION 'The edit deadline has passed.';
  END IF;
  IF now() > event_row.end_time THEN RAISE EXCEPTION 'This event has already ended.'; END IF;
  IF reg_row.registration_kind = 'proxy'
     AND NULLIF(btrim(COALESCE(p_proxy_note, reg_row.proxy_note, '')), '') IS NULL THEN
    RAISE EXCEPTION 'The proxy note is required.';
  END IF;
  PERFORM public.validate_event_registration_answers(reg_row.event_id, COALESCE(p_answers, '{}'::jsonb));
  FOR attendee IN SELECT value FROM jsonb_array_elements(p_attendees) LOOP
    attendee_name := NULLIF(btrim(COALESCE(attendee ->> 'name', '')), '');
    IF attendee_name IS NULL OR length(attendee_name) > 200 THEN
      RAISE EXCEPTION 'Each attendee needs a valid name.';
    END IF;
  END LOOP;

  SELECT COALESCE(sum(r.participant_count), 0)::INTEGER INTO used_seats
  FROM public.event_registrations r
  WHERE r.event_id = reg_row.event_id AND r.status = 'confirmed' AND r.id <> reg_row.id;
  IF event_row.max_participants IS NOT NULL
     AND used_seats + p_participant_count > event_row.max_participants THEN
    result_status := CASE WHEN event_row.allow_waitlist THEN 'waitlist' ELSE 'full' END;
  END IF;
  IF result_status = 'full' THEN RAISE EXCEPTION 'This event is full.'; END IF;

  requested_vehicle := CASE WHEN event_row.vehicle_selection_mode = 'self_select'
    THEN COALESCE(p_vehicle_id, reg_row.requested_vehicle_id, reg_row.vehicle_id) ELSE NULL END;
  IF event_row.vehicle_selection_mode = 'self_select' THEN
    IF requested_vehicle IS NULL THEN RAISE EXCEPTION 'Please select a vehicle.'; END IF;
    SELECT * INTO vehicle_row FROM public.event_vehicles v
    WHERE v.id = requested_vehicle AND v.event_id = reg_row.event_id AND v.is_active FOR UPDATE;
    IF vehicle_row.id IS NULL THEN RAISE EXCEPTION 'Selected vehicle is unavailable.'; END IF;
  END IF;

  selected_vehicle := NULL;
  IF result_status = 'confirmed' AND event_row.vehicle_selection_mode = 'self_select' THEN
    SELECT COALESCE(sum(r.participant_count), 0)::INTEGER INTO used_seats
    FROM public.event_registrations r
    WHERE r.vehicle_id = requested_vehicle AND r.status = 'confirmed' AND r.id <> reg_row.id;
    IF used_seats + p_participant_count > vehicle_row.capacity - vehicle_row.reserved_seats THEN
      RAISE EXCEPTION 'The selected vehicle no longer has enough seats.';
    END IF;
    selected_vehicle := requested_vehicle;
  ELSIF result_status = 'confirmed' AND event_row.vehicle_selection_mode = 'admin' THEN
    selected_vehicle := reg_row.vehicle_id;
    IF selected_vehicle IS NOT NULL THEN
      SELECT * INTO vehicle_row FROM public.event_vehicles v
      WHERE v.id = selected_vehicle AND v.event_id = reg_row.event_id AND v.is_active FOR UPDATE;
      IF vehicle_row.id IS NULL THEN selected_vehicle := NULL; END IF;
      IF selected_vehicle IS NOT NULL THEN
        SELECT COALESCE(sum(r.participant_count), 0)::INTEGER INTO used_seats
        FROM public.event_registrations r
        WHERE r.vehicle_id = selected_vehicle AND r.status = 'confirmed' AND r.id <> reg_row.id;
        IF used_seats + p_participant_count > vehicle_row.capacity - vehicle_row.reserved_seats THEN
          selected_vehicle := NULL;
        END IF;
      END IF;
      IF selected_vehicle IS NULL THEN
        IF event_row.allow_waitlist THEN result_status := 'waitlist';
        ELSE RAISE EXCEPTION 'The assigned vehicle no longer has enough seats.'; END IF;
      END IF;
    END IF;
  ELSIF result_status = 'confirmed' AND event_row.vehicle_selection_mode = 'auto' THEN
    selected_vehicle := reg_row.vehicle_id;
    IF selected_vehicle IS NOT NULL THEN
      SELECT * INTO vehicle_row FROM public.event_vehicles v
      WHERE v.id = selected_vehicle AND v.event_id = reg_row.event_id AND v.is_active FOR UPDATE;
      IF vehicle_row.id IS NULL THEN selected_vehicle := NULL; END IF;
      IF selected_vehicle IS NOT NULL THEN
        SELECT COALESCE(sum(r.participant_count), 0)::INTEGER INTO used_seats
        FROM public.event_registrations r
        WHERE r.vehicle_id = selected_vehicle AND r.status = 'confirmed' AND r.id <> reg_row.id;
        IF used_seats + p_participant_count > vehicle_row.capacity - vehicle_row.reserved_seats THEN
          selected_vehicle := NULL;
        END IF;
      END IF;
    END IF;
    IF selected_vehicle IS NULL THEN
      FOR vehicle_row IN SELECT * FROM public.event_vehicles v
        WHERE v.event_id = reg_row.event_id AND v.is_active ORDER BY v.sort_order, v.name, v.id FOR UPDATE
      LOOP
        SELECT COALESCE(sum(r.participant_count), 0)::INTEGER INTO used_seats
        FROM public.event_registrations r
        WHERE r.vehicle_id = vehicle_row.id AND r.status = 'confirmed' AND r.id <> reg_row.id;
        IF used_seats + p_participant_count <= vehicle_row.capacity - vehicle_row.reserved_seats THEN
          selected_vehicle := vehicle_row.id;
          EXIT;
        END IF;
      END LOOP;
    END IF;
    IF selected_vehicle IS NULL THEN
      IF event_row.allow_waitlist THEN result_status := 'waitlist';
      ELSE RAISE EXCEPTION 'No vehicle has enough seats for this registration.'; END IF;
    END IF;
  END IF;

  UPDATE public.event_registrations r SET
    proxy_note = CASE WHEN r.registration_kind = 'proxy'
      THEN COALESCE(NULLIF(btrim(p_proxy_note), ''), reg_row.proxy_note) ELSE NULL END,
    participant_count = p_participant_count, answers = COALESCE(p_answers, '{}'::jsonb),
    vehicle_id = selected_vehicle, requested_vehicle_id = requested_vehicle,
    status = result_status, updated_at = now()
  WHERE r.id = reg_row.id;
  DELETE FROM public.event_registration_attendees a WHERE a.registration_id = reg_row.id;
  INSERT INTO public.event_registration_attendees (registration_id, name, phone, email, sort_order)
  SELECT reg_row.id, btrim(item ->> 'name'), NULLIF(btrim(item ->> 'phone'), ''),
    NULLIF(lower(btrim(item ->> 'email')), ''), ordinality::INTEGER - 1
  FROM jsonb_array_elements(p_attendees) WITH ORDINALITY AS items(item, ordinality);
  INSERT INTO public.event_registration_audit_logs(event_id, registration_id, actor_id, action, details)
  VALUES(reg_row.event_id, reg_row.id, caller_id, 'updated',
    jsonb_build_object('participant_count', p_participant_count, 'status', result_status));
  PERFORM public.promote_event_waitlist(target_event_id);
  RETURN QUERY SELECT reg_row.id, result_status, selected_vehicle, p_participant_count;
END;
$$;
REVOKE ALL ON FUNCTION public.update_event_registration(UUID, TEXT, INTEGER, JSONB, JSONB, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_event_registration(UUID, TEXT, INTEGER, JSONB, JSONB, UUID) TO authenticated;

DO $rename_cancel$
BEGIN
  IF to_regprocedure('public.cancel_event_registration_locked_impl(uuid)') IS NULL THEN
    EXECUTE 'ALTER FUNCTION public.cancel_event_registration(uuid) RENAME TO cancel_event_registration_locked_impl';
  END IF;
END;
$rename_cancel$;
REVOKE ALL ON FUNCTION public.cancel_event_registration_locked_impl(UUID) FROM PUBLIC, authenticated;
CREATE OR REPLACE FUNCTION public.cancel_event_registration(p_registration_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE target_event_id UUID; previous_vehicle_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication is required.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.event_registrations
    WHERE id = p_registration_id AND (user_id = auth.uid() OR public.has_admin_permission('events.manage'))) THEN
    RAISE EXCEPTION 'Registration not found.';
  END IF;
  SELECT event_id, vehicle_id INTO target_event_id, previous_vehicle_id
  FROM public.event_registrations WHERE id = p_registration_id;
  IF target_event_id IS NULL THEN RAISE EXCEPTION 'Registration not found.'; END IF;
  PERFORM 1 FROM public.events WHERE id = target_event_id FOR UPDATE;
  PERFORM public.cancel_event_registration_locked_impl(p_registration_id);
  UPDATE public.event_registrations SET vehicle_id = previous_vehicle_id
  WHERE id = p_registration_id AND status = 'cancelled' AND vehicle_id IS NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.cancel_event_registration(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_event_registration(UUID) TO authenticated;

DO $rename_admin_cancel$
BEGIN
  IF to_regprocedure('public.admin_cancel_event_registration_locked_impl(uuid,boolean)') IS NULL THEN
    EXECUTE 'ALTER FUNCTION public.admin_cancel_event_registration(uuid,boolean) RENAME TO admin_cancel_event_registration_locked_impl';
  END IF;
END;
$rename_admin_cancel$;
REVOKE ALL ON FUNCTION public.admin_cancel_event_registration_locked_impl(UUID, BOOLEAN) FROM PUBLIC, authenticated;
CREATE OR REPLACE FUNCTION public.admin_cancel_event_registration(p_registration_id UUID, p_notify BOOLEAN DEFAULT FALSE)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE target_event_id UUID; previous_vehicle_id UUID;
BEGIN
  IF NOT public.has_admin_permission('events.manage') THEN RAISE EXCEPTION 'Event management permission is required.'; END IF;
  SELECT event_id, vehicle_id INTO target_event_id, previous_vehicle_id
  FROM public.event_registrations WHERE id = p_registration_id;
  IF target_event_id IS NULL THEN RAISE EXCEPTION 'Registration not found.'; END IF;
  PERFORM 1 FROM public.events WHERE id = target_event_id FOR UPDATE;
  PERFORM public.admin_cancel_event_registration_locked_impl(p_registration_id, p_notify);
  UPDATE public.event_registrations SET vehicle_id = previous_vehicle_id
  WHERE id = p_registration_id AND status = 'cancelled' AND vehicle_id IS NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_cancel_event_registration(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_cancel_event_registration(UUID, BOOLEAN) TO authenticated;

DO $rename_admin_promote$
BEGIN
  IF to_regprocedure('public.admin_promote_event_registration_locked_impl(uuid)') IS NULL THEN
    EXECUTE 'ALTER FUNCTION public.admin_promote_event_registration(uuid) RENAME TO admin_promote_event_registration_locked_impl';
  END IF;
END;
$rename_admin_promote$;
REVOKE ALL ON FUNCTION public.admin_promote_event_registration_locked_impl(UUID) FROM PUBLIC, authenticated;
CREATE OR REPLACE FUNCTION public.admin_promote_event_registration(p_registration_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE target_event_id UUID;
BEGIN
  IF NOT public.has_admin_permission('events.manage') THEN RAISE EXCEPTION 'Event management permission is required.'; END IF;
  SELECT event_id INTO target_event_id FROM public.event_registrations WHERE id = p_registration_id;
  IF target_event_id IS NULL THEN RAISE EXCEPTION 'Registration not found.'; END IF;
  PERFORM 1 FROM public.events WHERE id = target_event_id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM public.event_registrations r JOIN public.events e ON e.id = r.event_id
    WHERE r.id = p_registration_id AND r.status = 'waitlist'
      AND e.vehicle_selection_mode = 'self_select' AND r.requested_vehicle_id IS NOT NULL) THEN
    PERFORM public.admin_assign_event_registration(p_registration_id,
      (SELECT requested_vehicle_id FROM public.event_registrations WHERE id = p_registration_id));
  ELSE
    PERFORM public.admin_promote_event_registration_locked_impl(p_registration_id);
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_promote_event_registration(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_promote_event_registration(UUID) TO authenticated;

-- Registration writes must use capacity-checked RPCs. Keep the older admin
-- client's vehicle grant during rollout; the capacity trigger protects it.
REVOKE INSERT, UPDATE, DELETE ON public.event_registrations, public.event_registration_attendees FROM authenticated;
REVOKE ALL ON FUNCTION public.promote_event_waitlist(UUID) FROM PUBLIC, authenticated;
