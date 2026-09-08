-- Existing projects should run migrations/021_switch_cron_to_secret_keys.sql.
-- Never place a service-role credential directly in this file or cron.job.command.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
