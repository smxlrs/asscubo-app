-- Restrict ordinary, unconfirmed sign-ups to approved university domains.
-- Admin-created users that are auto-confirmed are intentionally exempt.

CREATE TABLE IF NOT EXISTS public.allowed_signup_domains (
  domain TEXT PRIMARY KEY,
  institution_name TEXT NOT NULL DEFAULT '博洛尼亚大学',
  enabled BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO public.allowed_signup_domains (domain, institution_name)
VALUES
  ('studio.unibo.it', '博洛尼亚大学'),
  ('unibo.it', '博洛尼亚大学'),
  ('esterni.unibo.it', '博洛尼亚大学')
ON CONFLICT (domain) DO UPDATE SET institution_name = EXCLUDED.institution_name, enabled = EXCLUDED.enabled;

ALTER TABLE public.allowed_signup_domains ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.allowed_signup_domains FROM PUBLIC;
REVOKE ALL ON TABLE public.allowed_signup_domains FROM anon;
REVOKE ALL ON TABLE public.allowed_signup_domains FROM authenticated;
GRANT SELECT ON TABLE public.allowed_signup_domains TO anon, authenticated;
DROP POLICY IF EXISTS "Public can read enabled signup domains" ON public.allowed_signup_domains;
CREATE POLICY "Public can read enabled signup domains" ON public.allowed_signup_domains FOR SELECT TO anon, authenticated USING (enabled = TRUE);

CREATE OR REPLACE FUNCTION public.enforce_signup_email_domain()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  email_domain TEXT;
BEGIN
  -- Auto-confirmed users created from the Supabase dashboard are exempt.
  IF NEW.email_confirmed_at IS NOT NULL
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
