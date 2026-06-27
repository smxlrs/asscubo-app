-- 1. Add is_banned column to public.profiles table if it doesn't exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_banned BOOLEAN NOT NULL DEFAULT false;

-- 2. Update public.admin_get_users function to return is_banned column
CREATE OR REPLACE FUNCTION public.admin_get_users()
RETURNS TABLE (
  id UUID,
  name TEXT,
  avatar_url TEXT,
  email TEXT,
  role TEXT,
  push_token TEXT,
  is_banned BOOLEAN,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  -- Only allow authenticated admin or super_admin users to access
  IF EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('admin', 'super_admin')
  ) THEN
    RETURN QUERY
    SELECT 
      p.id,
      p.name,
      p.avatar_url,
      u.email::TEXT,
      p.role,
      p.push_token,
      p.is_banned,
      p.created_at
    FROM public.profiles p
    JOIN auth.users u ON p.id = u.id
    ORDER BY p.created_at DESC;
  ELSE
    RAISE EXCEPTION 'Access denied. Admin privileges required.';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create public.admin_delete_user function to delete a user from auth.users (requires security definer)
CREATE OR REPLACE FUNCTION public.admin_delete_user(target_user_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Only allow authenticated admin or super_admin users to delete
  IF EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('admin', 'super_admin')
  ) THEN
    -- Delete user from auth.users (requires security definer)
    DELETE FROM auth.users WHERE id = target_user_id;
  ELSE
    RAISE EXCEPTION 'Access denied. Admin privileges required.';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
