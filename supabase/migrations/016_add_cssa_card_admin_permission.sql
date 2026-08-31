-- Add the reserved CSSA card management permission.
ALTER TABLE public.admin_permissions
  DROP CONSTRAINT IF EXISTS admin_permissions_permission_check;

ALTER TABLE public.admin_permissions
  ADD CONSTRAINT admin_permissions_permission_check CHECK (permission IN (
    'feedback.manage',
    'articles.sync',
    'articles.manage',
    'notifications.publish',
    'notifications.manage',
    'users.moderate',
    'users.delete',
    'events.manage',
    'handbook.manage',
    'community.moderate',
    'cssa_card.manage'
  ));

CREATE OR REPLACE FUNCTION public.get_my_admin_permissions()
RETURNS TEXT[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  caller_role TEXT;
  all_permissions CONSTANT TEXT[] := ARRAY[
    'feedback.manage', 'articles.sync', 'articles.manage',
    'notifications.publish', 'notifications.manage',
    'users.moderate', 'users.delete', 'events.manage',
    'handbook.manage', 'community.moderate', 'cssa_card.manage'
  ];
BEGIN
  SELECT role INTO caller_role
  FROM public.profiles
  WHERE id = auth.uid();

  IF caller_role = 'super_admin' THEN
    RETURN all_permissions;
  ELSIF caller_role = 'admin' THEN
    RETURN COALESCE(
      (SELECT array_agg(permission ORDER BY permission)
       FROM public.admin_permissions
       WHERE admin_id = auth.uid()),
      ARRAY[]::TEXT[]
    );
  END IF;

  RETURN ARRAY[]::TEXT[];
END;
$$;

CREATE OR REPLACE FUNCTION public.super_admin_set_admin_access(
  target_user_id UUID,
  make_admin BOOLEAN,
  new_permissions TEXT[] DEFAULT ARRAY[]::TEXT[]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  target_role TEXT;
  invalid_permissions TEXT[];
  allowed_permissions CONSTANT TEXT[] := ARRAY[
    'feedback.manage', 'articles.sync', 'articles.manage',
    'notifications.publish', 'notifications.manage',
    'users.moderate', 'users.delete', 'events.manage',
    'handbook.manage', 'community.moderate', 'cssa_card.manage'
  ];
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'super_admin'
  ) THEN
    RAISE EXCEPTION 'Only a super administrator can manage administrators.';
  END IF;

  SELECT role INTO target_role
  FROM public.profiles
  WHERE id = target_user_id
  FOR UPDATE;

  IF target_role IS NULL THEN
    RAISE EXCEPTION 'Target user does not exist.';
  END IF;

  IF target_role = 'super_admin' THEN
    RAISE EXCEPTION 'Super administrators can only be changed from the Supabase Dashboard.';
  END IF;

  SELECT array_agg(permission_name)
  INTO invalid_permissions
  FROM unnest(COALESCE(new_permissions, ARRAY[]::TEXT[])) AS requested(permission_name)
  WHERE NOT (permission_name = ANY (allowed_permissions));

  IF invalid_permissions IS NOT NULL THEN
    RAISE EXCEPTION 'Unknown administrator permissions: %', invalid_permissions;
  END IF;

  DELETE FROM public.admin_permissions WHERE admin_id = target_user_id;

  IF make_admin THEN
    UPDATE public.profiles SET role = 'admin' WHERE id = target_user_id;

    INSERT INTO public.admin_permissions (admin_id, permission, granted_by)
    SELECT target_user_id, permission_name, auth.uid()
    FROM unnest(COALESCE(new_permissions, ARRAY[]::TEXT[])) AS requested(permission_name)
    ON CONFLICT (admin_id, permission) DO NOTHING;
  ELSE
    UPDATE public.profiles SET role = 'student' WHERE id = target_user_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_admin_permissions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_admin_permissions() TO authenticated;
REVOKE ALL ON FUNCTION public.super_admin_set_admin_access(UUID, BOOLEAN, TEXT[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.super_admin_set_admin_access(UUID, BOOLEAN, TEXT[]) TO authenticated;
