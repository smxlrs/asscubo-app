-- Run once in the Supabase SQL Editor if the original profile trigger was not
-- applied. It creates a profile server-side, before any unconfirmed user has a
-- client session, so it remains compatible with profiles RLS.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, role)
  VALUES (
    NEW.id,
    NULLIF(NEW.raw_user_meta_data ->> 'name', ''),
    'student'
  )
  ON CONFLICT (id) DO UPDATE
  SET name = COALESCE(public.profiles.name, EXCLUDED.name);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
