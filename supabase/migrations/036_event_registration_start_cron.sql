-- DEPRECATED: replaced by 037_event_registration_start_one_shot.sql.
-- This file is kept for history because it may already have been executed.
-- Invoke the scheduled registration-start worker every minute.
-- Before running this migration, create a Vault secret named
-- event_registration_start_secret_key containing an active sb_secret_... key.

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;

DO $migration$
DECLARE
  existing_job_id BIGINT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'event_registration_start_secret_key') THEN
    RAISE EXCEPTION 'Vault secret event_registration_start_secret_key is missing.';
  END IF;

  SELECT jobid INTO existing_job_id FROM cron.job
  WHERE jobname = 'event-registration-start-notifications' LIMIT 1;
  IF existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job_id);
  END IF;

  PERFORM cron.schedule(
    'event-registration-start-notifications',
    '* * * * *',
    $cron$
    SELECT net.http_post(
      url := 'https://avxzgaozbfeqttmhmlld.supabase.co/functions/v1/event-registration-start-notifications',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', (
          SELECT decrypted_secret FROM vault.decrypted_secrets
          WHERE name = 'event_registration_start_secret_key' LIMIT 1
        )
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 120000
    );
    $cron$
  );
END;
$migration$;
