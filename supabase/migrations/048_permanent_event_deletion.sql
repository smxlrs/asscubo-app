-- Explicit second-stage deletion. Existing soft-delete/history behavior remains.
BEGIN;
CREATE OR REPLACE FUNCTION public.admin_permanently_delete_event(
  p_event_id UUID, p_expected_revision BIGINT
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE event_row public.events%ROWTYPE;
BEGIN
  IF NOT public.has_admin_permission('events.manage') THEN
    RAISE EXCEPTION 'Event management permission is required.';
  END IF;
  SELECT * INTO event_row FROM public.events WHERE id = p_event_id FOR UPDATE;
  IF event_row.id IS NULL THEN RAISE EXCEPTION 'Event not found.'; END IF;
  IF event_row.revision IS DISTINCT FROM p_expected_revision THEN
    RAISE EXCEPTION 'Event changed; reload before deleting.';
  END IF;
  IF event_row.deleted_at IS NULL THEN
    RAISE EXCEPTION 'Move the event to deleted events before permanently deleting it.';
  END IF;
  PERFORM public.unschedule_event_notification_job(p_event_id);
  -- Cascades remove registrations, attendees, vehicles, audits, jobs and batches.
  DELETE FROM public.events WHERE id = p_event_id;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_permanently_delete_event(UUID, BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_permanently_delete_event(UUID, BIGINT) TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
