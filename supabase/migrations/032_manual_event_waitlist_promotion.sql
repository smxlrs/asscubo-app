-- Stop automatic waitlist promotion after registration closes and provide an
-- explicit admin action for promoting an individual waitlisted registration.

CREATE OR REPLACE FUNCTION public.admin_promote_event_registration(
  p_registration_id UUID
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
  assigned_vehicle UUID;
  caller_id UUID := auth.uid();
BEGIN
  IF NOT public.has_admin_permission('events.manage') THEN
    RAISE EXCEPTION 'Event management permission is required.';
  END IF;
  SELECT * INTO reg_row FROM public.event_registrations WHERE id = p_registration_id FOR UPDATE;
  IF reg_row.id IS NULL THEN RAISE EXCEPTION 'Registration not found.'; END IF;
  IF reg_row.status <> 'waitlist' THEN RAISE EXCEPTION 'Only waitlisted registrations can be promoted.'; END IF;
  SELECT * INTO event_row FROM public.events WHERE id = reg_row.event_id FOR UPDATE;
  IF event_row.id IS NULL THEN RAISE EXCEPTION 'Event not found.'; END IF;

  SELECT COALESCE(sum(participant_count), 0)::INTEGER INTO confirmed_count
  FROM public.event_registrations
  WHERE event_id = reg_row.event_id AND status = 'confirmed';
  IF event_row.max_participants IS NOT NULL
     AND confirmed_count + reg_row.participant_count > event_row.max_participants THEN
    RAISE EXCEPTION 'This event is full.';
  END IF;

  IF event_row.vehicle_selection_mode IN ('auto', 'self_select') THEN
    FOR vehicle_row IN
      SELECT * FROM public.event_vehicles
      WHERE event_id = reg_row.event_id AND is_active = TRUE
      ORDER BY sort_order, name, id FOR UPDATE
    LOOP
      SELECT COALESCE(sum(participant_count), 0)::INTEGER INTO used_seats
      FROM public.event_registrations
      WHERE vehicle_id = vehicle_row.id AND status = 'confirmed';
      IF used_seats + reg_row.participant_count <= vehicle_row.capacity - vehicle_row.reserved_seats THEN
        assigned_vehicle := vehicle_row.id;
        EXIT;
      END IF;
    END LOOP;
    IF assigned_vehicle IS NULL THEN
      RAISE EXCEPTION 'No vehicle has enough seats.';
    END IF;
  ELSIF event_row.vehicle_selection_mode = 'admin' THEN
    RAISE EXCEPTION 'Please assign a vehicle before promoting this registration.';
  END IF;

  UPDATE public.event_registrations
  SET status = 'confirmed', vehicle_id = assigned_vehicle, updated_at = now()
  WHERE id = reg_row.id;
  INSERT INTO public.event_registration_audit_logs (event_id, registration_id, actor_id, action, details)
  VALUES (reg_row.event_id, reg_row.id, caller_id, 'admin_waitlist_promoted',
          jsonb_build_object('vehicle_id', assigned_vehicle));
END;
$$;

REVOKE ALL ON FUNCTION public.admin_promote_event_registration(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_promote_event_registration(UUID) TO authenticated;
