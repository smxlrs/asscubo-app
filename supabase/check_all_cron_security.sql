-- Read-only verification for all scheduled jobs. No secret values are returned.

SELECT
  jobid,
  jobname,
  schedule,
  active,
  position('vault.decrypted_secrets' IN command) > 0 AS reads_secret_from_vault,
  position('''apikey''' IN command) > 0 AS uses_apikey_header,
  position('Bearer eyJ' IN command) > 0 AS contains_plaintext_jwt
FROM cron.job
ORDER BY jobid;

SELECT name, description, created_at, updated_at
FROM vault.secrets
WHERE name IN ('wechat_sync_secret_key', 'tper_alerts_secret_key')
ORDER BY name;

SELECT id, last_success_at AT TIME ZONE 'Europe/Rome' AS last_success_at_rome,
       last_error, updated_at AT TIME ZONE 'Europe/Rome' AS updated_at_rome
FROM public.tper_alert_sync_state
WHERE id = 1;
