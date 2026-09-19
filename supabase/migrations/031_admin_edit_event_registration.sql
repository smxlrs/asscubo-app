-- Allow event managers to edit or cancel an individual registration and,
-- optionally, create a targeted notification for the owning account.

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS target_type TEXT NOT NULL DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS target_value TEXT,
  ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES public.events(id) ON DELETE SET NULL;

DO $$
DECLARE
  constraint_row RECORD;
BEGIN
  FOR constraint_row IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.notifications'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%target_type%'
  LOOP
    EXECUTE format('ALTER TABLE public.notifications DROP CONSTRAINT %I', constraint_row.conname);
  END LOOP;
  ALTER TABLE public.notifications
    ADD CONSTRAINT notifications_target_type_check
    CHECK (target_type IN ('all', 'faculty', 'year', 'campus', 'user'));
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

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
  event_title TEXT;
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

  SELECT * INTO reg_row FROM public.event_registrations
  WHERE id = p_registration_id FOR UPDATE;
  IF reg_row.id IS NULL THEN RAISE EXCEPTION 'Registration not found.'; END IF;
  SELECT title INTO event_title FROM public.events WHERE id = reg_row.event_id;
  SELECT * INTO attendee_row FROM public.event_registration_attendees
  WHERE registration_id = p_registration_id ORDER BY sort_order ASC LIMIT 1 FOR UPDATE;
  IF attendee_row.id IS NULL THEN RAISE EXCEPTION 'Registration attendee not found.'; END IF;

  UPDATE public.event_registrations
  SET answers = COALESCE(p_answers, '{}'::jsonb), updated_at = now()
  WHERE id = p_registration_id;
  UPDATE public.event_registration_attendees
  SET name = btrim(p_name), phone = NULLIF(btrim(COALESCE(p_phone, '')), ''),
      email = NULLIF(lower(btrim(COALESCE(p_email, ''))), ''),
      answers = COALESCE(p_answers, '{}'::jsonb), updated_at = now()
  WHERE id = attendee_row.id;

  INSERT INTO public.event_registration_audit_logs (event_id, registration_id, actor_id, action, details)
  VALUES (reg_row.event_id, reg_row.id, caller_id, 'admin_updated', jsonb_build_object('notified', p_notify));

  IF p_notify AND reg_row.user_id IS NOT NULL THEN
    INSERT INTO public.notifications (title, content, category, target_type, target_value, event_id)
    VALUES ('活动报名信息变更', format('您的%s报名信息已被修改，请注意核实', COALESCE(event_title, '活动')), 'events', 'user', reg_row.user_id::TEXT, reg_row.event_id);
  END IF;
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
  event_title TEXT;
  caller_id UUID := auth.uid();
BEGIN
  IF NOT public.has_admin_permission('events.manage') THEN
    RAISE EXCEPTION 'Event management permission is required.';
  END IF;
  SELECT * INTO reg_row FROM public.event_registrations WHERE id = p_registration_id FOR UPDATE;
  IF reg_row.id IS NULL THEN RAISE EXCEPTION 'Registration not found.'; END IF;
  SELECT title INTO event_title FROM public.events WHERE id = reg_row.event_id;
  IF reg_row.status <> 'cancelled' THEN
    UPDATE public.event_registrations
    SET status = 'cancelled', cancelled_at = now(), updated_at = now(), vehicle_id = NULL
    WHERE id = p_registration_id;
    INSERT INTO public.event_registration_audit_logs (event_id, registration_id, actor_id, action, details)
    VALUES (reg_row.event_id, reg_row.id, caller_id, 'admin_cancelled', jsonb_build_object('notified', p_notify));
    PERFORM public.promote_event_waitlist(reg_row.event_id);
  END IF;
  IF p_notify AND reg_row.user_id IS NOT NULL THEN
    INSERT INTO public.notifications (title, content, category, target_type, target_value, event_id)
    VALUES ('活动报名已取消', format('您的%s报名已被取消，请注意核实', COALESCE(event_title, '活动')), 'events', 'user', reg_row.user_id::TEXT, reg_row.event_id);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_event_registration(UUID, TEXT, TEXT, TEXT, JSONB, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_event_registration(UUID, TEXT, TEXT, TEXT, JSONB, BOOLEAN) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_cancel_event_registration(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_cancel_event_registration(UUID, BOOLEAN) TO authenticated;
