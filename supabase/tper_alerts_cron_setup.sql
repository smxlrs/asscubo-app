-- Run once in the Supabase SQL editor after deploying the tper-alerts edge function.
-- Replace both placeholders with values from your Supabase project settings.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'tper-alerts-scheduled-sync';

SELECT cron.schedule(
  'tper-alerts-scheduled-sync',
  '*/15 * * * *',
  $$
    SELECT net.http_post(
      url := 'https://avxzgaozbfeqttmhmlld.supabase.co/functions/v1/tper-alerts',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer <CURRENT_SERVICE_ROLE_KEY>'
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000
    );
  $$
);
