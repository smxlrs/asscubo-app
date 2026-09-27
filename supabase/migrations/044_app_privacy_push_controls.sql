-- Per-device delivery controls, logout unlinking, and private profiles.
BEGIN;
ALTER TABLE public.push_tokens ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.push_tokens ADD COLUMN IF NOT EXISTS night_quiet BOOLEAN NOT NULL DEFAULT FALSE;

DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());

CREATE OR REPLACE FUNCTION public.register_push_token(device_token TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF device_token IS NULL OR device_token !~ '^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$' THEN
    RAISE EXCEPTION 'Invalid push token.';
  END IF;
  INSERT INTO public.push_tokens(user_id, token, updated_at) VALUES(auth.uid(), device_token, now())
  ON CONFLICT(token) DO UPDATE SET user_id = auth.uid(), updated_at = now();
END;
$$;

-- The token is a device capability; it is not publicly readable. Guests can
-- opt out and detach their own installation without keeping a user session.
CREATE OR REPLACE FUNCTION public.configure_push_device(device_token TEXT, p_enabled BOOLEAN, p_night_quiet BOOLEAN, p_detach BOOLEAN DEFAULT FALSE)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF p_enabled IS NULL OR p_night_quiet IS NULL OR p_detach IS NULL THEN RAISE EXCEPTION 'Invalid preferences.'; END IF;
  PERFORM public.register_push_token(device_token);
  UPDATE public.push_tokens SET enabled = p_enabled, night_quiet = p_night_quiet,
    user_id = CASE WHEN p_detach THEN NULL ELSE auth.uid() END, updated_at = now() WHERE token = device_token;
  IF p_detach THEN
    UPDATE public.profiles SET push_token = NULL WHERE push_token = device_token;
  ELSIF auth.uid() IS NOT NULL THEN
    UPDATE public.profiles SET push_token = CASE WHEN p_enabled THEN device_token ELSE NULL END WHERE id = auth.uid();
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.configure_push_device(TEXT, BOOLEAN, BOOLEAN, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.configure_push_device(TEXT, BOOLEAN, BOOLEAN, BOOLEAN) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.push_delivery_allowed(p_token TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS(SELECT 1 FROM public.push_tokens t WHERE t.token = p_token AND t.enabled
    AND (NOT t.night_quiet OR extract(hour FROM now() AT TIME ZONE 'Europe/Rome') >= 8
      AND extract(hour FROM now() AT TIME ZONE 'Europe/Rome') < 22));
$$;
REVOKE ALL ON FUNCTION public.push_delivery_allowed(TEXT) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.push_delivery_tokens(p_offset INTEGER DEFAULT 0, p_limit INTEGER DEFAULT 500, p_user_id UUID DEFAULT NULL)
RETURNS TABLE(token TEXT) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' AND NOT public.has_admin_permission('notifications.publish')
    AND NOT (p_user_id IS NOT NULL AND public.has_admin_permission('users.moderate')) THEN
    RAISE EXCEPTION 'Notification permission is required.';
  END IF;
  IF p_offset IS NULL OR p_offset < 0 OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'Invalid page.'; END IF;
  RETURN QUERY SELECT t.token FROM public.push_tokens t
    WHERE (p_user_id IS NULL OR t.user_id = p_user_id) AND public.push_delivery_allowed(t.token)
    ORDER BY t.token LIMIT p_limit OFFSET p_offset;
END;
$$;
REVOKE ALL ON FUNCTION public.push_delivery_tokens(INTEGER, INTEGER, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.push_delivery_tokens(INTEGER, INTEGER, UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.event_push_recipients_internal(p_event_id UUID)
RETURNS TABLE(token TEXT) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT DISTINCT t.token FROM public.push_tokens t JOIN public.events e ON e.id = p_event_id
  WHERE public.push_delivery_allowed(t.token)
    AND (e.audience = 'all' OR EXISTS(SELECT 1 FROM public.profiles p
      WHERE p.id = t.user_id AND p.role IN ('admin','super_admin') AND NOT p.is_banned));
$$;
REVOKE ALL ON FUNCTION public.event_push_recipients_internal(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.event_push_recipients_internal(UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.filter_event_push_batch(p_event_id UUID, p_tokens TEXT[])
RETURNS TABLE(token TEXT) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT r.token FROM public.event_push_recipients_internal(p_event_id) r WHERE r.token = ANY(p_tokens);
$$;
REVOKE ALL ON FUNCTION public.filter_event_push_batch(UUID, TEXT[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.filter_event_push_batch(UUID, TEXT[]) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
