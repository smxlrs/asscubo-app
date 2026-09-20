-- Replace the global every-minute worker with one scheduled job per enabled event.
-- The existing Vault secret event_registration_start_secret_key is reused.

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;

DO $migration$
DECLARE
  existing_job_id BIGINT;
BEGIN
  SELECT jobid INTO existing_job_id
  FROM cron.job
  WHERE jobname = 'event-registration-start-notifications'
  LIMIT 1;
  IF existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job_id);
  END IF;
END;
$migration$;

CREATE OR REPLACE FUNCTION public.dispatch_event_registration_start_notification(
  p_event_id UUID,
  p_job_name TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  event_row public.events%ROWTYPE;
  job_id BIGINT;
BEGIN
  SELECT * INTO event_row FROM public.events WHERE id = p_event_id;

  IF event_row.id IS NULL
     OR event_row.deleted_at IS NOT NULL
     OR NOT event_row.is_published
     OR event_row.registration_status <> 'open'
     OR NOT COALESCE(event_row.registration_start_notify_enabled, FALSE)
     OR event_row.registration_start_at IS NULL THEN
    SELECT jobid INTO job_id FROM cron.job WHERE jobname = p_job_name LIMIT 1;
    IF job_id IS NOT NULL THEN PERFORM cron.unschedule(job_id); END IF;
    RETURN;
  END IF;

  -- A cron expression has no year field. Keep the job for a future matching
  -- annual occurrence until the actual timestamp is reached.
  IF event_row.registration_start_at > now() THEN
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := 'https://avxzgaozbfeqttmhmlld.supabase.co/functions/v1/event-registration-start-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (
        SELECT decrypted_secret FROM vault.decrypted_secrets
        WHERE name = 'event_registration_start_secret_key' LIMIT 1
      )
    ),
    body := jsonb_build_object('event_id', p_event_id),
    timeout_milliseconds := 120000
  );

  SELECT jobid INTO job_id FROM cron.job WHERE jobname = p_job_name LIMIT 1;
  IF job_id IS NOT NULL THEN PERFORM cron.unschedule(job_id); END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.schedule_event_registration_start_notification(
  p_event_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  event_row public.events%ROWTYPE;
  job_name TEXT := 'event-registration-start-' || replace(p_event_id::TEXT, '-', '');
  old_job_id BIGINT;
  start_utc TIMESTAMPTZ;
  cron_expression TEXT;
BEGIN
  -- Authenticated RPC callers must be event managers. The NULL auth.uid()
  -- case is only used by the migration backfill running as the database owner.
  IF auth.uid() IS NOT NULL AND NOT public.has_admin_permission('events.manage') THEN
    RAISE EXCEPTION 'Event management permission is required.';
  END IF;

  SELECT jobid INTO old_job_id FROM cron.job WHERE jobname = job_name LIMIT 1;
  IF old_job_id IS NOT NULL THEN PERFORM cron.unschedule(old_job_id); END IF;

  SELECT * INTO event_row FROM public.events WHERE id = p_event_id;
  IF event_row.id IS NULL THEN RAISE EXCEPTION 'Event not found.'; END IF;
  IF NOT COALESCE(event_row.registration_start_notify_enabled, FALSE)
     OR event_row.registration_start_at IS NULL
     OR event_row.deleted_at IS NOT NULL
     OR NOT event_row.is_published
     OR event_row.registration_status <> 'open' THEN
    RETURN FALSE;
  END IF;

  start_utc := event_row.registration_start_at;
  IF start_utc <= now() THEN
    PERFORM public.dispatch_event_registration_start_notification(p_event_id, job_name);
    RETURN TRUE;
  END IF;

  cron_expression := format(
    '%s %s %s %s *',
    extract(minute FROM (start_utc AT TIME ZONE 'UTC'))::INTEGER,
    extract(hour FROM (start_utc AT TIME ZONE 'UTC'))::INTEGER,
    extract(day FROM (start_utc AT TIME ZONE 'UTC'))::INTEGER,
    extract(month FROM (start_utc AT TIME ZONE 'UTC'))::INTEGER
  );

  PERFORM cron.schedule(
    job_name,
    cron_expression,
    format('SELECT public.dispatch_event_registration_start_notification(%L::uuid, %L);', p_event_id::TEXT, job_name)
  );
  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.schedule_event_registration_start_notification(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.schedule_event_registration_start_notification(UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.dispatch_event_registration_start_notification(UUID, TEXT) FROM PUBLIC;

-- Recreate one-shot jobs for any events that were already configured before
-- this migration replaced the global worker.
DO $backfill$
DECLARE
  event_id UUID;
BEGIN
  FOR event_id IN
    SELECT id
    FROM public.events
    WHERE registration_start_notify_enabled = TRUE
      AND registration_start_at IS NOT NULL
      AND deleted_at IS NULL
      AND is_published = TRUE
      AND registration_status = 'open'
  LOOP
    PERFORM public.schedule_event_registration_start_notification(event_id);
  END LOOP;
END;
$backfill$;
