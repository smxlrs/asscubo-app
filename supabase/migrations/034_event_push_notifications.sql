-- Event managers need to read tokens for targeted Expo Push notifications.
DROP POLICY IF EXISTS "Event managers can read push tokens" ON public.push_tokens;
CREATE POLICY "Event managers can read push tokens" ON public.push_tokens
  FOR SELECT TO authenticated
  USING (
    public.has_admin_permission('events.manage')
    OR public.has_admin_permission('notifications.publish')
  );

-- Registration change notifications are delivered by Expo Push from the admin flow.
-- Keep the database notification feed separate from event-registration operations.
CREATE OR REPLACE FUNCTION public.admin_update_event_registration(
  p_registration_id UUID,
  p_name TEXT,
  p_phone TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_answers JSONB DEFAULT '{}'::jsonb,
  p_notify BOOLEAN DEFAULT FALSE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  reg_row public.event_registrations%ROWTYPE;
  attendee_row public.event_registration_attendees%ROWTYPE;
  caller_id UUID := auth.uid();
BEGIN
  IF NOT public.has_admin_permission('events.manage') THEN
    RAISE EXCEPTION 'Event management permission is required.';
  END IF;
  IF NULLIF(btrim(COALESCE(p_name, '')), '') IS NULL OR length(btrim(p_name)) > 200 THEN
    RAISE EXCEPTION 'Each attendee needs a valid name.';
  END IF;
  PERFORM public.validate_event_registration_answers(
    (SELECT event_id FROM public.event_registrations WHERE id = p_registration_id),
    COALESCE(p_answers, '{}'::jsonb)
  );
  SELECT * INTO reg_row FROM public.event_registrations WHERE id = p_registration_id FOR UPDATE;
  IF reg_row.id IS NULL THEN RAISE EXCEPTION 'Registration not found.'; END IF;
  SELECT * INTO attendee_row FROM public.event_registration_attendees
  WHERE registration_id = p_registration_id ORDER BY sort_order ASC LIMIT 1 FOR UPDATE;
  IF attendee_row.id IS NULL THEN RAISE EXCEPTION 'Registration attendee not found.'; END IF;
  UPDATE public.event_registrations SET answers = COALESCE(p_answers, '{}'::jsonb), updated_at = now() WHERE id = p_registration_id;
  UPDATE public.event_registration_attendees
  SET name = btrim(p_name), phone = NULLIF(btrim(COALESCE(p_phone, '')), ''),
      email = NULLIF(lower(btrim(COALESCE(p_email, ''))), ''),
      answers = COALESCE(p_answers, '{}'::jsonb), updated_at = now()
  WHERE id = attendee_row.id;
  INSERT INTO public.event_registration_audit_logs (event_id, registration_id, actor_id, action, details)
  VALUES (reg_row.event_id, reg_row.id, caller_id, 'admin_updated', jsonb_build_object('notified', p_notify));
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_cancel_event_registration(
  p_registration_id UUID,
  p_notify BOOLEAN DEFAULT FALSE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  reg_row public.event_registrations%ROWTYPE;
  caller_id UUID := auth.uid();
BEGIN
  IF NOT public.has_admin_permission('events.manage') THEN
    RAISE EXCEPTION 'Event management permission is required.';
  END IF;
  SELECT * INTO reg_row FROM public.event_registrations WHERE id = p_registration_id FOR UPDATE;
  IF reg_row.id IS NULL THEN RAISE EXCEPTION 'Registration not found.'; END IF;
  IF reg_row.status <> 'cancelled' THEN
    UPDATE public.event_registrations
    SET status = 'cancelled', cancelled_at = now(), updated_at = now(), vehicle_id = NULL
    WHERE id = p_registration_id;
    INSERT INTO public.event_registration_audit_logs (event_id, registration_id, actor_id, action, details)
    VALUES (reg_row.event_id, reg_row.id, caller_id, 'admin_cancelled', jsonb_build_object('notified', p_notify));
    PERFORM public.promote_event_waitlist(reg_row.event_id);
  END IF;
END;
$$;
