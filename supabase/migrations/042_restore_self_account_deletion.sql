-- Repair databases where the function appended to 001 was never installed.
-- Only the caller's account can be removed. Existing auth.users deletion
-- triggers (including 040 seat release) and foreign-key cascades remain active.
BEGIN;

CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  caller_id UUID := auth.uid();
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to delete your account.'
      USING ERRCODE = '42501';
  END IF;

  DELETE FROM auth.users WHERE id = caller_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Your account no longer exists. Please sign in again.'
      USING ERRCODE = '42501';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_user_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_user_account() TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
