-- Read-only verification for the secured WeChat synchronization schedule.

SELECT
  jobid,
  jobname,
  schedule,
  active,
  position('vault.decrypted_secrets' IN command) > 0 AS reads_secret_from_vault,
  position('''apikey''' IN command) > 0 AS uses_apikey_header,
  position('Bearer eyJ' IN command) > 0 AS contains_plaintext_jwt
FROM cron.job
WHERE jobname = 'wechat-scheduled-sync';

SELECT
  started_at AT TIME ZONE 'Europe/Rome' AS started_at_rome,
  completed_at AT TIME ZONE 'Europe/Rome' AS completed_at_rome,
  trigger,
  status,
  result
FROM public.wechat_sync_runs
ORDER BY started_at DESC
LIMIT 5;
