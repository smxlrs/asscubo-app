-- Allow Supabase dashboard/admin-created users while keeping ordinary signups restricted.
-- Supabase creates dashboard users without an email confirmation token. A normal
-- email signup has a confirmation token at the auth.users INSERT stage.

CREATE OR REPLACE FUNCTION public.enforce_signup_email_domain()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  email_domain TEXT;
  confirmation_token TEXT;
BEGIN
  confirmation_token := NULLIF(COALESCE(NEW.confirmation_token, ''), '');

  -- Confirmed/admin-provisioned users do not go through ordinary signup.
  -- Dashboard-created users have no confirmation token during INSERT.
  IF NEW.email_confirmed_at IS NOT NULL
     OR confirmation_token IS NULL
     OR COALESCE(NEW.raw_user_meta_data ->> 'created_by_admin', 'false') = 'true' THEN
    RETURN NEW;
  END IF;

  email_domain := lower(split_part(COALESCE(NEW.email, ''), '@', 2));

  IF NOT EXISTS (
    SELECT 1
    FROM public.allowed_signup_domains
    WHERE enabled = TRUE AND lower(domain) = email_domain
  ) THEN
    RAISE EXCEPTION 'Registration requires an approved university email domain.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_signup_email_domain ON auth.users;
CREATE TRIGGER enforce_signup_email_domain
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_signup_email_domain();
