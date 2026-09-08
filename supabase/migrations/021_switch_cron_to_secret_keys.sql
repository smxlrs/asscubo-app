-- Switch the scheduled Edge Function calls from the compromised legacy
-- service-role JWT to per-job secret keys stored in Supabase Vault.
--
-- Before running this migration, create these Vault entries in the Dashboard:
--   wechat_sync_secret_key
--   tper_alerts_secret_key
-- Their values must be active sb_secret_... API keys. This file never contains
-- or returns either value.

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;

DO $migration$
DECLARE
  wechat_secret_exists BOOLEAN;
  tper_secret_exists BOOLEAN;
  existing_job_id BIGINT;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM vault.secrets WHERE name = 'wechat_sync_secret_key'
  ) INTO wechat_secret_exists;

  SELECT EXISTS (
    SELECT 1 FROM vault.secrets WHERE name = 'tper_alerts_secret_key'
  ) INTO tper_secret_exists;

  IF NOT wechat_secret_exists OR NOT tper_secret_exists THEN
    RAISE EXCEPTION 'Required Vault secret keys are missing. No cron jobs were changed.';
  END IF;

  SELECT jobid INTO existing_job_id
  FROM cron.job WHERE jobname = 'wechat-scheduled-sync' LIMIT 1;
  IF existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job_id);
  END IF;

  PERFORM cron.schedule(
    'wechat-scheduled-sync',
    '*/30 * * * *',
    $cron$
    SELECT net.http_post(
      url := 'https://avxzgaozbfeqttmhmlld.supabase.co/functions/v1/wechat-sync',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', (
          SELECT decrypted_secret FROM vault.decrypted_secrets
          WHERE name = 'wechat_sync_secret_key' LIMIT 1
        )
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 120000
    );
    $cron$
  );

  existing_job_id := NULL;
  SELECT jobid INTO existing_job_id
  FROM cron.job WHERE jobname = 'tper-alerts-scheduled-sync' LIMIT 1;
  IF existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job_id);
  END IF;

  PERFORM cron.schedule(
    'tper-alerts-scheduled-sync',
    '*/15 * * * *',
    $cron$
    SELECT net.http_post(
      url := 'https://avxzgaozbfeqttmhmlld.supabase.co/functions/v1/tper-alerts',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', (
          SELECT decrypted_secret FROM vault.decrypted_secrets
          WHERE name = 'tper_alerts_secret_key' LIMIT 1
        )
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000
    );
    $cron$
  );
END;
$migration$;

-- Metadata-only verification. Secret values are never returned.
SELECT name, description, created_at, updated_at
FROM vault.secrets
WHERE name IN ('wechat_sync_secret_key', 'tper_alerts_secret_key')
ORDER BY name;

SELECT jobid, jobname, schedule, active,
       position('vault.decrypted_secrets' IN command) > 0 AS reads_secret_from_vault,
       position('''apikey''' IN command) > 0 AS uses_apikey_header,
       position('Bearer eyJ' IN command) > 0 AS contains_plaintext_jwt
FROM cron.job
WHERE jobname IN ('wechat-scheduled-sync', 'tper-alerts-scheduled-sync')
ORDER BY jobid;
