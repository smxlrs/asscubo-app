-- Permanently remove cancelled event registrations and their attendee rows.
-- Active, waitlisted, and confirmed registrations are intentionally protected.

CREATE OR REPLACE FUNCTION public.admin_delete_cancelled_event_registration(
  p_registration_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  reg_row public.event_registrations%ROWTYPE;
BEGIN
  IF NOT public.has_admin_permission('events.manage') THEN
    RAISE EXCEPTION 'Event management permission is required.';
  END IF;

  SELECT * INTO reg_row
  FROM public.event_registrations
  WHERE id = p_registration_id
  FOR UPDATE;

  IF reg_row.id IS NULL THEN
    RAISE EXCEPTION 'Registration not found.';
  END IF;
  IF reg_row.status <> 'cancelled' THEN
    RAISE EXCEPTION 'Only cancelled registrations can be permanently deleted.';
  END IF;

  -- event_registration_attendees.registration_id is ON DELETE CASCADE.
  DELETE FROM public.event_registrations
  WHERE id = p_registration_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_cancelled_event_registration(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_cancelled_event_registration(UUID) TO authenticated;
