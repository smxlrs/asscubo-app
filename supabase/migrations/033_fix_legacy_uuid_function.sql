-- Some existing databases have uuid-ossp installed outside the function
-- search_path used by the event RPCs. Provide a public compatibility wrapper
-- so already-installed functions using uuid_generate_v4() keep working.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'uuid_generate_v4'
      AND p.pronargs = 0
  ) THEN
    CREATE FUNCTION public.uuid_generate_v4()
    RETURNS UUID
    LANGUAGE SQL
    VOLATILE
    SET search_path = public, extensions, pg_temp
    AS 'SELECT gen_random_uuid()';
  END IF;
END;
$$;
