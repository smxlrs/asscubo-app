-- All administrators may read registered users; management grants stay separate.
BEGIN;
CREATE OR REPLACE FUNCTION public.admin_get_registered_users()
RETURNS TABLE (
  id UUID, name TEXT, avatar_url TEXT, email TEXT, role TEXT,
  is_banned BOOLEAN, created_at TIMESTAMPTZ, has_push_token BOOLEAN
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles caller
    WHERE caller.id = auth.uid() AND caller.role IN ('admin', 'super_admin')
      AND caller.is_banned IS NOT TRUE
  ) THEN
    RAISE EXCEPTION 'Administrator access is required.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY SELECT p.id, p.name, p.avatar_url, u.email::TEXT, p.role,
    p.is_banned, p.created_at, COALESCE(p.push_token <> '', FALSE)
  FROM public.profiles p JOIN auth.users u ON u.id = p.id
  ORDER BY CASE p.role WHEN 'super_admin' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END,
    p.created_at DESC;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_get_registered_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_registered_users() TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
