-- Delete abandoned email sign-ups after three days.
-- Run this once in the Supabase SQL Editor.

CREATE OR REPLACE FUNCTION public.cleanup_unverified_users()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM auth.users
  WHERE email_confirmed_at IS NULL
    AND created_at < now() - interval '3 days'
    -- Admin-provisioned accounts can opt out of cleanup.
    AND COALESCE(raw_user_meta_data ->> 'created_by_admin', 'false') <> 'true';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_unverified_users() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cleanup_unverified_users() FROM anon;
REVOKE ALL ON FUNCTION public.cleanup_unverified_users() FROM authenticated;

-- Keep exactly one daily cleanup job if this script is run again.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

DO $job$
DECLARE
  existing_job_id bigint;
BEGIN
  SELECT jobid INTO existing_job_id
  FROM cron.job
  WHERE jobname = 'cleanup-unverified-users-daily';

  IF existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job_id);
  END IF;

  PERFORM cron.schedule(
    'cleanup-unverified-users-daily',
    '0 3 * * *',
    $cmd$SELECT public.cleanup_unverified_users();$cmd$
  );
END;
$job$;
