BEGIN;

-- Failed guesses must commit rather than disappear in a raised exception.
CREATE TABLE IF NOT EXISTS public.account_deletion_attempts (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  failures INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE public.account_deletion_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.account_deletion_attempts FROM PUBLIC, anon, authenticated;

-- Close the old no-OTP path, including calls from an old client.
CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  RAISE EXCEPTION 'A fresh email verification code is required. Update the App and try again.' USING ERRCODE = '42501';
END;
$$;
REVOKE ALL ON FUNCTION public.delete_user_account() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.delete_user_account(p_nonce TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  caller_id UUID := auth.uid();
  account auth.users%ROWTYPE;
  attempts public.account_deletion_attempts%ROWTYPE;
BEGIN
  IF caller_id IS NULL THEN RETURN FALSE; END IF;
  SELECT * INTO account FROM auth.users WHERE id = caller_id FOR UPDATE;
  IF NOT FOUND THEN RETURN FALSE; END IF;
  INSERT INTO public.account_deletion_attempts(user_id) VALUES(caller_id) ON CONFLICT DO NOTHING;
  SELECT * INTO attempts FROM public.account_deletion_attempts WHERE user_id = caller_id FOR UPDATE;
  IF attempts.window_started_at <= now() - interval '15 minutes' THEN
    UPDATE public.account_deletion_attempts SET failures = 0, window_started_at = now() WHERE user_id = caller_id;
    attempts.failures := 0;
  END IF;
  IF attempts.failures >= 5 THEN RETURN FALSE; END IF;
  -- Supabase Auth Reauthenticate hashes the exact email + nonce using SHA-224.
  -- Do not use verifyOtp(type: 'reauthentication'): Auth does not expose that OTP type.
  IF p_nonce IS NULL OR p_nonce !~ '^[0-9]{6,10}$'
    OR account.email IS NULL OR account.email_confirmed_at IS NULL
    OR COALESCE(account.reauthentication_token, '') = ''
    OR account.reauthentication_sent_at IS NULL
    OR account.reauthentication_sent_at < now() - interval '10 minutes'
    OR account.reauthentication_sent_at > now()
    OR account.reauthentication_token IS DISTINCT FROM encode(sha224(convert_to(account.email || p_nonce, 'UTF8')), 'hex') THEN
    UPDATE public.account_deletion_attempts SET failures = failures + 1 WHERE user_id = caller_id;
    RETURN FALSE;
  END IF;
  -- Verifying and deleting are one locked transaction. No reusable verification
  -- flag is issued, and the existing seat-release/cascade triggers still run.
  DELETE FROM auth.users WHERE id = caller_id;
  RETURN TRUE;
END;
$$;
REVOKE ALL ON FUNCTION public.delete_user_account(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_user_account(TEXT) TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
