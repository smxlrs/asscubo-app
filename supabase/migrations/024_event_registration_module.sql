-- Activity registration module.
-- The original event_registrations table was only a placeholder.  This migration
-- keeps the table name for compatibility, but routes user writes through
-- SECURITY DEFINER functions so capacity and vehicle assignment are atomic.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS registration_status TEXT NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS registration_mode TEXT NOT NULL DEFAULT 'authenticated',
  ADD COLUMN IF NOT EXISTS registration_start_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS registration_form JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS registration_form_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS vehicle_selection_mode TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS allow_proxy_registration BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS allow_waitlist BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS has_end_date BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS start_has_time BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS end_has_time BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'events_registration_status_check'
  ) THEN
    ALTER TABLE public.events
      ADD CONSTRAINT events_registration_status_check
      CHECK (registration_status IN ('draft', 'open', 'closed', 'ended', 'archived'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'events_registration_mode_check'
  ) THEN
    ALTER TABLE public.events
      ADD CONSTRAINT events_registration_mode_check
      CHECK (registration_mode IN ('authenticated', 'public'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'events_vehicle_selection_mode_check'
  ) THEN
    ALTER TABLE public.events
      ADD CONSTRAINT events_vehicle_selection_mode_check
      CHECK (vehicle_selection_mode IN ('none', 'auto', 'self_select', 'admin'));
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.event_vehicles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  capacity INTEGER NOT NULL CHECK (capacity > 0 AND capacity <= 1000),
  reserved_seats INTEGER NOT NULL DEFAULT 0 CHECK (reserved_seats >= 0),
  boarding_stop TEXT,
  departure_time TEXT,
  notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (reserved_seats <= capacity)
);

ALTER TABLE public.event_registrations
  ADD COLUMN IF NOT EXISTS registration_kind TEXT NOT NULL DEFAULT 'self',
  ADD COLUMN IF NOT EXISTS proxy_note TEXT,
  ADD COLUMN IF NOT EXISTS participant_count INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS form_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS vehicle_id UUID REFERENCES public.event_vehicles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'app',
  ADD COLUMN IF NOT EXISTS registration_number TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'event_registrations_registration_kind_check'
  ) THEN
    ALTER TABLE public.event_registrations
      ADD CONSTRAINT event_registrations_registration_kind_check
      CHECK (registration_kind IN ('self', 'proxy'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'event_registrations_participant_count_check'
  ) THEN
    ALTER TABLE public.event_registrations
      ADD CONSTRAINT event_registrations_participant_count_check
      CHECK (participant_count BETWEEN 1 AND 100);
  END IF;
END;
$$;

-- The placeholder constraint allowed only one row per account, which would
-- prevent one account from helping more than one person.
ALTER TABLE public.event_registrations
  DROP CONSTRAINT IF EXISTS event_registrations_event_id_user_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS event_registrations_one_self_per_event
  ON public.event_registrations (event_id, user_id)
  WHERE registration_kind = 'self' AND status <> 'cancelled';

CREATE INDEX IF NOT EXISTS event_registrations_event_status_idx
  ON public.event_registrations (event_id, status);
CREATE INDEX IF NOT EXISTS event_registrations_user_idx
  ON public.event_registrations (user_id, registered_at DESC);
CREATE INDEX IF NOT EXISTS event_registrations_vehicle_idx
  ON public.event_registrations (vehicle_id, status);

CREATE TABLE IF NOT EXISTS public.event_registration_attendees (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  registration_id UUID REFERENCES public.event_registrations(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS event_registration_attendees_registration_idx
  ON public.event_registration_attendees (registration_id, sort_order);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_vehicles TO authenticated;
GRANT SELECT ON public.event_vehicles TO anon;
GRANT SELECT ON public.event_registration_attendees TO authenticated;

CREATE TABLE IF NOT EXISTS public.event_registration_audit_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  registration_id UUID REFERENCES public.event_registrations(id) ON DELETE SET NULL,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.event_registration_audit_logs TO authenticated;

ALTER TABLE public.event_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_registration_attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_registration_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Published events viewable by all" ON public.events;
CREATE POLICY "Published events viewable by all" ON public.events
  FOR SELECT TO anon, authenticated
  USING (
    is_published = TRUE
    AND deleted_at IS NULL
    AND registration_status IN ('open', 'closed', 'ended')
  );

DROP POLICY IF EXISTS "Authorized admins can manage events" ON public.events;
DROP POLICY IF EXISTS "Admins can manage events" ON public.events;
CREATE POLICY "Authorized admins can manage events" ON public.events
  FOR ALL TO authenticated
  USING (public.has_admin_permission('events.manage'))
  WITH CHECK (public.has_admin_permission('events.manage'));

DROP POLICY IF EXISTS "Public can view event vehicles" ON public.event_vehicles;
CREATE POLICY "Public can view event vehicles" ON public.event_vehicles
  FOR SELECT TO anon, authenticated
  USING (
    is_active = TRUE
    AND EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_vehicles.event_id
        AND e.is_published = TRUE
        AND e.deleted_at IS NULL
        AND e.registration_status IN ('open', 'closed', 'ended')
    )
  );

DROP POLICY IF EXISTS "Authorized admins can manage event vehicles" ON public.event_vehicles;
CREATE POLICY "Authorized admins can manage event vehicles" ON public.event_vehicles
  FOR ALL TO authenticated
  USING (public.has_admin_permission('events.manage'))
  WITH CHECK (public.has_admin_permission('events.manage'));

DROP POLICY IF EXISTS "Users can register" ON public.event_registrations;
DROP POLICY IF EXISTS "Users can cancel own registration" ON public.event_registrations;
DROP POLICY IF EXISTS "Authorized admins can manage event registrations" ON public.event_registrations;
DROP POLICY IF EXISTS "Admins can view all registrations" ON public.event_registrations;
CREATE POLICY "Authorized admins can manage event registrations" ON public.event_registrations
  FOR ALL TO authenticated
  USING (public.has_admin_permission('events.manage'))
  WITH CHECK (public.has_admin_permission('events.manage'));

DROP POLICY IF EXISTS "Users can view own registrations" ON public.event_registrations;
CREATE POLICY "Users can view own registrations" ON public.event_registrations
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can view own registration attendees" ON public.event_registration_attendees;
CREATE POLICY "Users can view own registration attendees" ON public.event_registration_attendees
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.event_registrations r
      WHERE r.id = event_registration_attendees.registration_id
        AND r.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Authorized admins can manage registration attendees" ON public.event_registration_attendees;
CREATE POLICY "Authorized admins can manage registration attendees" ON public.event_registration_attendees
  FOR ALL TO authenticated
  USING (public.has_admin_permission('events.manage'))
  WITH CHECK (public.has_admin_permission('events.manage'));

DROP POLICY IF EXISTS "Authorized admins can view registration audit logs" ON public.event_registration_audit_logs;
CREATE POLICY "Authorized admins can view registration audit logs" ON public.event_registration_audit_logs
  FOR SELECT TO authenticated
  USING (public.has_admin_permission('events.manage'));

CREATE OR REPLACE FUNCTION public.validate_event_registration_answers(
  p_event_id UUID,
  p_answers JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  field JSONB;
  field_key TEXT;
  field_type TEXT;
  value JSONB;
BEGIN
  IF p_answers IS NULL OR jsonb_typeof(p_answers) <> 'object' THEN
    RAISE EXCEPTION 'Registration answers must be an object.';
  END IF;

  FOR field IN
    SELECT value
    FROM jsonb_array_elements(
      COALESCE((SELECT registration_form FROM public.events WHERE id = p_event_id), '[]'::jsonb)
    )
  LOOP
    field_key := NULLIF(field ->> 'key', '');
    field_type := COALESCE(field ->> 'type', 'text');
    IF field_key IS NULL OR (field ->> 'system') = 'true' THEN
      CONTINUE;
    END IF;

    value := p_answers -> field_key;

    IF (field ->> 'required') = 'true' AND (
      value IS NULL
      OR value = 'null'::jsonb
      OR (jsonb_typeof(value) = 'string' AND btrim(value #>> '{}') = '')
      OR (jsonb_typeof(value) = 'array' AND jsonb_array_length(value) = 0)
      OR (field_type = 'checkbox' AND value = 'false'::jsonb)
    ) THEN
      RAISE EXCEPTION 'Required registration field is missing: %', field_key;
    END IF;

    IF value IS NOT NULL AND value <> 'null'::jsonb AND field_type = 'email'
       AND NOT ((value #>> '{}') ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$') THEN
      RAISE EXCEPTION 'Invalid email value for field: %', field_key;
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_event_registration_answers(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_event_registration_answers(UUID, JSONB) TO authenticated;

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
  idx INTEGER := 0;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to register.';
  END IF;

  IF p_registration_kind NOT IN ('self', 'proxy') THEN
    RAISE EXCEPTION 'Invalid registration kind.';
  END IF;
  IF p_participant_count < 1 OR p_participant_count > 100 THEN
    RAISE EXCEPTION 'Participant count must be between 1 and 100.';
  END IF;
  IF p_registration_kind = 'proxy'
     AND (NOT EXISTS (
       SELECT 1 FROM public.events WHERE id = p_event_id AND allow_proxy_registration = TRUE
     ) OR NULLIF(btrim(COALESCE(p_proxy_note, '')), '') IS NULL) THEN
    RAISE EXCEPTION 'This event does not allow proxy registration or the proxy note is missing.';
  END IF;
  IF jsonb_typeof(COALESCE(p_attendees, '[]'::jsonb)) <> 'array'
     OR jsonb_array_length(COALESCE(p_attendees, '[]'::jsonb)) <> p_participant_count THEN
    RAISE EXCEPTION 'Provide one attendee name for each participant.';
  END IF;

  SELECT * INTO event_row
  FROM public.events
  WHERE id = p_event_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF event_row.id IS NULL THEN
    RAISE EXCEPTION 'Event does not exist.';
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
  IF now() > event_row.end_time THEN
    RAISE EXCEPTION 'This event has already ended.';
  END IF;

  PERFORM public.validate_event_registration_answers(p_event_id, COALESCE(p_answers, '{}'::jsonb));

  FOR attendee IN SELECT value FROM jsonb_array_elements(p_attendees)
  LOOP
    attendee_name := NULLIF(btrim(COALESCE(attendee ->> 'name', '')), '');
    IF attendee_name IS NULL OR length(attendee_name) > 200 THEN
      RAISE EXCEPTION 'Each attendee needs a valid name.';
    END IF;
    idx := idx + 1;
  END LOOP;

  IF p_registration_kind = 'self'
     AND EXISTS (
       SELECT 1 FROM public.event_registrations
       WHERE event_id = p_event_id
         AND user_id = caller_id
         AND registration_kind = 'self'
         AND status <> 'cancelled'
     ) THEN
    RAISE EXCEPTION 'You already have an active registration for this event.';
  END IF;

  SELECT COALESCE(sum(r.participant_count), 0)::INTEGER
  INTO current_confirmed
  FROM public.event_registrations r
  WHERE r.event_id = p_event_id AND r.status = 'confirmed';

  IF event_row.max_participants IS NOT NULL
     AND current_confirmed + p_participant_count > event_row.max_participants THEN
    result_status := CASE WHEN event_row.allow_waitlist THEN 'waitlist' ELSE 'full' END;
  END IF;

  IF result_status = 'confirmed' AND event_row.vehicle_selection_mode <> 'none' THEN
    IF event_row.vehicle_selection_mode = 'self_select' THEN
      IF selected_vehicle IS NULL THEN
        RAISE EXCEPTION 'Please select a vehicle.';
      END IF;
      SELECT * INTO vehicle_row
      FROM public.event_vehicles
      WHERE id = selected_vehicle AND event_id = p_event_id AND is_active = TRUE
      FOR UPDATE;
      IF vehicle_row.id IS NULL THEN
        RAISE EXCEPTION 'Selected vehicle is unavailable.';
      END IF;
      SELECT COALESCE(sum(r.participant_count), 0)::INTEGER
      INTO vehicle_confirmed
      FROM public.event_registrations r
      WHERE r.vehicle_id = vehicle_row.id AND r.status = 'confirmed';
      IF vehicle_confirmed + p_participant_count > vehicle_row.capacity - vehicle_row.reserved_seats THEN
        RAISE EXCEPTION 'The selected vehicle no longer has enough seats.';
      END IF;
    ELSIF event_row.vehicle_selection_mode = 'auto' THEN
      selected_vehicle := NULL;
      FOR vehicle_row IN
        SELECT * FROM public.event_vehicles
        WHERE event_id = p_event_id AND is_active = TRUE
        ORDER BY sort_order, name, id
        FOR UPDATE
      LOOP
        SELECT COALESCE(sum(r.participant_count), 0)::INTEGER
        INTO vehicle_confirmed
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

  IF result_status = 'full' THEN
    RAISE EXCEPTION 'This event is full.';
  END IF;

  -- A waitlisted registration never reserves a vehicle.  Ignore any client
  -- supplied vehicle for modes where the user cannot choose one.
  IF result_status = 'waitlist'
     OR event_row.vehicle_selection_mode IN ('none', 'auto', 'admin') THEN
    selected_vehicle := NULL;
  END IF;

  INSERT INTO public.event_registrations (
    event_id, user_id, registered_at, status, registration_kind, proxy_note,
    participant_count, answers, form_version, vehicle_id, source, registration_number, updated_at
  ) VALUES (
    p_event_id, caller_id, now(), result_status, p_registration_kind,
    CASE WHEN p_registration_kind = 'proxy' THEN NULLIF(btrim(p_proxy_note), '') ELSE NULL END,
    p_participant_count, COALESCE(p_answers, '{}'::jsonb),
    event_row.registration_form_version, selected_vehicle, COALESCE(NULLIF(p_source, ''), 'app'),
    upper(substr(replace(uuid_generate_v4()::TEXT, '-', ''), 1, 10)), now()
  )
  RETURNING id INTO new_registration_id;

  INSERT INTO public.event_registration_attendees (registration_id, name, phone, email, sort_order)
  SELECT
    new_registration_id,
    btrim(item ->> 'name'),
    NULLIF(btrim(item ->> 'phone'), ''),
    NULLIF(lower(btrim(item ->> 'email')), ''),
    ordinality::INTEGER - 1
  FROM jsonb_array_elements(p_attendees) WITH ORDINALITY AS items(item, ordinality);

  INSERT INTO public.event_registration_audit_logs (event_id, registration_id, actor_id, action, details)
  VALUES (
    p_event_id, new_registration_id, caller_id, 'created',
    jsonb_build_object('kind', p_registration_kind, 'participant_count', p_participant_count, 'status', result_status)
  );

  RETURN QUERY SELECT new_registration_id, result_status, selected_vehicle, p_participant_count;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_event_registration(UUID, TEXT, TEXT, INTEGER, JSONB, JSONB, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_event_registration(UUID, TEXT, TEXT, INTEGER, JSONB, JSONB, UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_event_registration(
  p_registration_id UUID,
  p_proxy_note TEXT DEFAULT NULL,
  p_participant_count INTEGER DEFAULT 1,
  p_answers JSONB DEFAULT '{}'::jsonb,
  p_attendees JSONB DEFAULT '[]'::jsonb,
  p_vehicle_id UUID DEFAULT NULL
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
  reg_row public.event_registrations%ROWTYPE;
  event_row public.events%ROWTYPE;
  vehicle_row public.event_vehicles%ROWTYPE;
  selected_vehicle UUID := p_vehicle_id;
  used_seats INTEGER;
  result_status TEXT;
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

  SELECT * INTO reg_row
  FROM public.event_registrations
  WHERE id = p_registration_id AND user_id = caller_id
  FOR UPDATE;
  IF reg_row.id IS NULL THEN RAISE EXCEPTION 'Registration not found.'; END IF;
  IF reg_row.status = 'cancelled' THEN RAISE EXCEPTION 'Cancelled registrations cannot be edited.'; END IF;

  SELECT * INTO event_row FROM public.events WHERE id = reg_row.event_id AND deleted_at IS NULL FOR UPDATE;
  IF event_row.id IS NULL OR event_row.registration_status <> 'open' THEN
    RAISE EXCEPTION 'This event is no longer accepting changes.';
  END IF;
  IF event_row.registration_deadline IS NOT NULL AND now() > event_row.registration_deadline THEN
    RAISE EXCEPTION 'The edit deadline has passed.';
  END IF;
  IF now() > event_row.end_time THEN
    RAISE EXCEPTION 'This event has already ended.';
  END IF;
  IF reg_row.registration_kind = 'proxy'
     AND NULLIF(btrim(COALESCE(p_proxy_note, reg_row.proxy_note, '')), '') IS NULL THEN
    RAISE EXCEPTION 'The proxy note is required.';
  END IF;

  PERFORM public.validate_event_registration_answers(reg_row.event_id, COALESCE(p_answers, '{}'::jsonb));
  FOR attendee IN SELECT value FROM jsonb_array_elements(p_attendees)
  LOOP
    attendee_name := NULLIF(btrim(COALESCE(attendee ->> 'name', '')), '');
    IF attendee_name IS NULL OR length(attendee_name) > 200 THEN
      RAISE EXCEPTION 'Each attendee needs a valid name.';
    END IF;
  END LOOP;

  result_status := reg_row.status;
  IF event_row.max_participants IS NOT NULL THEN
    SELECT COALESCE(sum(r.participant_count), 0)::INTEGER
    INTO used_seats
    FROM public.event_registrations r
    WHERE r.event_id = reg_row.event_id
      AND r.status = 'confirmed'
      AND r.id <> reg_row.id;
    IF used_seats + p_participant_count > event_row.max_participants THEN
      IF event_row.allow_waitlist THEN
        result_status := 'waitlist';
      ELSE
        RAISE EXCEPTION 'This event is full.';
      END IF;
    ELSE
      result_status := 'confirmed';
    END IF;
  ELSE
    result_status := 'confirmed';
  END IF;

  IF result_status <> 'confirmed' THEN
    selected_vehicle := NULL;
  ELSIF event_row.vehicle_selection_mode = 'self_select' THEN
    selected_vehicle := COALESCE(selected_vehicle, reg_row.vehicle_id);
    IF selected_vehicle IS NULL THEN RAISE EXCEPTION 'Please select a vehicle.'; END IF;
    SELECT * INTO vehicle_row FROM public.event_vehicles
    WHERE id = selected_vehicle AND event_id = reg_row.event_id AND is_active = TRUE FOR UPDATE;
    IF vehicle_row.id IS NULL THEN RAISE EXCEPTION 'Selected vehicle is unavailable.'; END IF;
    SELECT COALESCE(sum(r.participant_count), 0)::INTEGER INTO used_seats
    FROM public.event_registrations r
    WHERE r.vehicle_id = selected_vehicle AND r.status = 'confirmed' AND r.id <> reg_row.id;
    IF used_seats + p_participant_count > vehicle_row.capacity - vehicle_row.reserved_seats THEN
      RAISE EXCEPTION 'The selected vehicle no longer has enough seats.';
    END IF;
  ELSIF event_row.vehicle_selection_mode = 'none' OR event_row.vehicle_selection_mode = 'admin' THEN
    selected_vehicle := CASE WHEN event_row.vehicle_selection_mode = 'admin' THEN reg_row.vehicle_id ELSE NULL END;
    IF event_row.vehicle_selection_mode = 'admin' AND selected_vehicle IS NOT NULL THEN
      SELECT * INTO vehicle_row FROM public.event_vehicles
      WHERE id = selected_vehicle AND event_id = reg_row.event_id AND is_active = TRUE FOR UPDATE;
      IF vehicle_row.id IS NULL THEN
        selected_vehicle := NULL;
        IF event_row.allow_waitlist THEN
          result_status := 'waitlist';
        ELSE
          RAISE EXCEPTION 'The assigned vehicle is no longer available.';
        END IF;
      ELSE
        SELECT COALESCE(sum(r.participant_count), 0)::INTEGER INTO used_seats
        FROM public.event_registrations r
        WHERE r.vehicle_id = selected_vehicle AND r.status = 'confirmed' AND r.id <> reg_row.id;
        IF used_seats + p_participant_count > vehicle_row.capacity - vehicle_row.reserved_seats THEN
          selected_vehicle := NULL;
          IF event_row.allow_waitlist THEN
            result_status := 'waitlist';
          ELSE
            RAISE EXCEPTION 'The assigned vehicle no longer has enough seats.';
          END IF;
        END IF;
      END IF;
    END IF;
  ELSE
    -- Automatic mode keeps the current vehicle while it can hold the group.
    selected_vehicle := reg_row.vehicle_id;
    IF selected_vehicle IS NOT NULL THEN
      SELECT * INTO vehicle_row FROM public.event_vehicles
      WHERE id = selected_vehicle AND event_id = reg_row.event_id AND is_active = TRUE FOR UPDATE;
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
      FOR vehicle_row IN SELECT * FROM public.event_vehicles
        WHERE event_id = reg_row.event_id AND is_active = TRUE
        ORDER BY sort_order, name, id FOR UPDATE
      LOOP
        SELECT COALESCE(sum(r.participant_count), 0)::INTEGER INTO used_seats
        FROM public.event_registrations r
        WHERE r.vehicle_id = vehicle_row.id AND r.status = 'confirmed' AND r.id <> reg_row.id;
        IF used_seats + p_participant_count <= vehicle_row.capacity - vehicle_row.reserved_seats THEN
          selected_vehicle := vehicle_row.id; EXIT;
        END IF;
      END LOOP;
    END IF;
    IF selected_vehicle IS NULL AND event_row.allow_waitlist THEN result_status := 'waitlist'; END IF;
    IF selected_vehicle IS NULL AND NOT event_row.allow_waitlist THEN
      RAISE EXCEPTION 'No vehicle has enough seats for this registration.';
    END IF;
  END IF;

  UPDATE public.event_registrations
  SET proxy_note = CASE
        WHEN registration_kind = 'proxy' THEN COALESCE(NULLIF(btrim(p_proxy_note), ''), reg_row.proxy_note)
        ELSE NULL
      END,
      participant_count = p_participant_count,
      answers = COALESCE(p_answers, '{}'::jsonb),
      vehicle_id = selected_vehicle,
      status = result_status,
      updated_at = now()
  WHERE id = reg_row.id;

  DELETE FROM public.event_registration_attendees WHERE registration_id = reg_row.id;
  INSERT INTO public.event_registration_attendees (registration_id, name, phone, email, sort_order)
  SELECT reg_row.id, btrim(item ->> 'name'), NULLIF(btrim(item ->> 'phone'), ''),
         NULLIF(lower(btrim(item ->> 'email')), ''), ordinality::INTEGER - 1
  FROM jsonb_array_elements(p_attendees) WITH ORDINALITY AS items(item, ordinality);

  INSERT INTO public.event_registration_audit_logs (event_id, registration_id, actor_id, action, details)
  VALUES (reg_row.event_id, reg_row.id, caller_id, 'updated',
          jsonb_build_object('participant_count', p_participant_count, 'status', result_status));

  RETURN QUERY SELECT reg_row.id, result_status, selected_vehicle, p_participant_count;
END;
$$;

REVOKE ALL ON FUNCTION public.update_event_registration(UUID, TEXT, INTEGER, JSONB, JSONB, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_event_registration(UUID, TEXT, INTEGER, JSONB, JSONB, UUID) TO authenticated;

-- Promote waitlisted registrations in registration order whenever capacity is released.
-- Vehicle assignment follows the event mode; admin-assigned events remain pending until
-- an administrator chooses a vehicle.
CREATE OR REPLACE FUNCTION public.promote_event_waitlist(p_event_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  event_row public.events%ROWTYPE;
  reg_row public.event_registrations%ROWTYPE;
  vehicle_row public.event_vehicles%ROWTYPE;
  assigned_vehicle UUID;
  confirmed_count INTEGER;
  used_seats INTEGER;
  promoted INTEGER := 0;
BEGIN
  SELECT * INTO event_row FROM public.events WHERE id = p_event_id FOR UPDATE;
  IF event_row.id IS NULL THEN RETURN 0; END IF;

  FOR reg_row IN
    SELECT * FROM public.event_registrations
    WHERE event_id = p_event_id AND status = 'waitlist'
    ORDER BY registered_at ASC, id ASC
    FOR UPDATE
  LOOP
    assigned_vehicle := NULL;

    SELECT COALESCE(sum(participant_count), 0)::INTEGER INTO confirmed_count
    FROM public.event_registrations
    WHERE event_id = p_event_id AND status = 'confirmed';
    IF event_row.max_participants IS NOT NULL
       AND confirmed_count + reg_row.participant_count > event_row.max_participants THEN
      CONTINUE;
    END IF;

    IF event_row.vehicle_selection_mode = 'admin' THEN
      CONTINUE;
    ELSIF event_row.vehicle_selection_mode IN ('auto', 'self_select') THEN
      -- Prefer the stored choice when present, then fall back to the normal vehicle order.
      IF reg_row.vehicle_id IS NOT NULL THEN
        SELECT * INTO vehicle_row FROM public.event_vehicles
        WHERE id = reg_row.vehicle_id AND event_id = p_event_id AND is_active = TRUE
        FOR UPDATE;
        IF vehicle_row.id IS NOT NULL THEN
          SELECT COALESCE(sum(participant_count), 0)::INTEGER INTO used_seats
          FROM public.event_registrations
          WHERE vehicle_id = vehicle_row.id AND status = 'confirmed';
          IF used_seats + reg_row.participant_count <= vehicle_row.capacity - vehicle_row.reserved_seats THEN
            assigned_vehicle := vehicle_row.id;
          END IF;
        END IF;
      END IF;
      IF assigned_vehicle IS NULL THEN
        FOR vehicle_row IN
          SELECT * FROM public.event_vehicles
          WHERE event_id = p_event_id AND is_active = TRUE
          ORDER BY sort_order, name, id
          FOR UPDATE
        LOOP
          SELECT COALESCE(sum(participant_count), 0)::INTEGER INTO used_seats
          FROM public.event_registrations
          WHERE vehicle_id = vehicle_row.id AND status = 'confirmed';
          IF used_seats + reg_row.participant_count <= vehicle_row.capacity - vehicle_row.reserved_seats THEN
            assigned_vehicle := vehicle_row.id;
            EXIT;
          END IF;
        END LOOP;
      END IF;
      IF assigned_vehicle IS NULL THEN CONTINUE; END IF;
    END IF;

    UPDATE public.event_registrations
    SET status = 'confirmed', vehicle_id = assigned_vehicle, updated_at = now()
    WHERE id = reg_row.id;
    INSERT INTO public.event_registration_audit_logs (event_id, registration_id, action, details)
    VALUES (p_event_id, reg_row.id, 'waitlist_promoted',
            jsonb_build_object('vehicle_id', assigned_vehicle));
    promoted := promoted + 1;
  END LOOP;
  RETURN promoted;
END;
$$;

REVOKE ALL ON FUNCTION public.promote_event_waitlist(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.promote_event_waitlist(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_event_registration(p_registration_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  reg_row public.event_registrations%ROWTYPE;
  caller_id UUID := auth.uid();
BEGIN
  IF caller_id IS NULL THEN RAISE EXCEPTION 'Authentication is required.'; END IF;
  SELECT * INTO reg_row FROM public.event_registrations
  WHERE id = p_registration_id AND (user_id = caller_id OR public.has_admin_permission('events.manage'))
  FOR UPDATE;
  IF reg_row.id IS NULL THEN RAISE EXCEPTION 'Registration not found.'; END IF;
  IF reg_row.status = 'cancelled' THEN RETURN; END IF;

  UPDATE public.event_registrations
  SET status = 'cancelled', cancelled_at = now(), updated_at = now(), vehicle_id = NULL
  WHERE id = p_registration_id;

  INSERT INTO public.event_registration_audit_logs (event_id, registration_id, actor_id, action)
  VALUES (reg_row.event_id, reg_row.id, caller_id, 'cancelled');

  PERFORM public.promote_event_waitlist(reg_row.event_id);
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_event_registration(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_event_registration(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_assign_event_registration(
  p_registration_id UUID,
  p_vehicle_id UUID
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
  caller_id UUID := auth.uid();
BEGIN
  IF NOT public.has_admin_permission('events.manage') THEN
    RAISE EXCEPTION 'Event management permission is required.';
  END IF;
  SELECT * INTO reg_row FROM public.event_registrations WHERE id = p_registration_id FOR UPDATE;
  IF reg_row.id IS NULL THEN RAISE EXCEPTION 'Registration not found.'; END IF;
  IF reg_row.status = 'cancelled' THEN RAISE EXCEPTION 'Cancelled registrations cannot be assigned.'; END IF;
  SELECT * INTO event_row FROM public.events WHERE id = reg_row.event_id;
  IF event_row.id IS NULL THEN RAISE EXCEPTION 'Event not found.'; END IF;

  IF p_vehicle_id IS NULL THEN
    IF NOT event_row.allow_waitlist THEN
      RAISE EXCEPTION 'This event does not allow unassigned waitlist entries.';
    END IF;
    UPDATE public.event_registrations
    SET vehicle_id = NULL, status = 'waitlist', updated_at = now()
    WHERE id = p_registration_id;
  ELSE
    SELECT * INTO vehicle_row FROM public.event_vehicles
    WHERE id = p_vehicle_id AND event_id = reg_row.event_id AND is_active = TRUE FOR UPDATE;
    IF vehicle_row.id IS NULL THEN RAISE EXCEPTION 'Vehicle is unavailable.'; END IF;
    SELECT COALESCE(sum(r.participant_count), 0)::INTEGER INTO used_seats
    FROM public.event_registrations r
    WHERE r.vehicle_id = p_vehicle_id AND r.status = 'confirmed' AND r.id <> reg_row.id;
    IF used_seats + reg_row.participant_count > vehicle_row.capacity - vehicle_row.reserved_seats THEN
      RAISE EXCEPTION 'The vehicle does not have enough seats.';
    END IF;
    UPDATE public.event_registrations
    SET vehicle_id = p_vehicle_id, status = 'confirmed', updated_at = now()
    WHERE id = p_registration_id;
  END IF;

  INSERT INTO public.event_registration_audit_logs (event_id, registration_id, actor_id, action, details)
  VALUES (reg_row.event_id, reg_row.id, caller_id, 'vehicle_assigned',
          jsonb_build_object('vehicle_id', p_vehicle_id));

  PERFORM public.promote_event_waitlist(reg_row.event_id);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_assign_event_registration(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_assign_event_registration(UUID, UUID) TO authenticated;

-- Keep file uploads available without making event attachments public.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'event-attachments') THEN
    INSERT INTO storage.buckets (id, name, public) VALUES ('event-attachments', 'event-attachments', FALSE);
  END IF;
END;
$$;

DROP POLICY IF EXISTS "Users can upload own event attachments" ON storage.objects;
CREATE POLICY "Users can upload own event attachments" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'event-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

DROP POLICY IF EXISTS "Users can view own event attachments" ON storage.objects;
CREATE POLICY "Users can view own event attachments" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'event-attachments'
    AND (
      (storage.foldername(name))[1] = auth.uid()::TEXT
      OR public.has_admin_permission('events.manage')
    )
  );

DROP POLICY IF EXISTS "Users can delete own event attachments" ON storage.objects;
CREATE POLICY "Users can delete own event attachments" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'event-attachments'
    AND (
      (storage.foldername(name))[1] = auth.uid()::TEXT
      OR public.has_admin_permission('events.manage')
    )
  );

-- Enable Supabase Realtime for the tables used by the administrator's live
-- registration view when the standard publication is available.
DO $$
DECLARE
  table_name TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH table_name IN ARRAY ARRAY[
      'event_registrations',
      'event_registration_attendees',
      'event_vehicles'
    ] LOOP
      IF NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = table_name
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', table_name);
      END IF;
    END LOOP;
  END IF;
END;
$$;
