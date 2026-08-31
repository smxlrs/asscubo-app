-- Fine-grained administrator permissions.
-- super_admin membership is intentionally managed only from the Supabase Dashboard.

CREATE TABLE IF NOT EXISTS public.admin_permissions (
  admin_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  permission TEXT NOT NULL CHECK (permission IN (
    'feedback.manage',
    'articles.sync',
    'articles.manage',
    'notifications.publish',
    'notifications.manage',
    'users.moderate',
    'users.delete',
    'events.manage',
    'handbook.manage',
    'community.moderate'
  )),
  granted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (admin_id, permission)
);

ALTER TABLE public.admin_permissions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_permissions FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.has_admin_permission(required_permission TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        p.role = 'super_admin'
        OR (
          p.role = 'admin'
          AND EXISTS (
            SELECT 1
            FROM public.admin_permissions ap
            WHERE ap.admin_id = p.id
              AND ap.permission = required_permission
          )
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.has_admin_permission(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_admin_permission(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_admin_permissions()
RETURNS TEXT[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  current_role TEXT;
  all_permissions CONSTANT TEXT[] := ARRAY[
    'feedback.manage', 'articles.sync', 'articles.manage',
    'notifications.publish', 'notifications.manage',
    'users.moderate', 'users.delete', 'events.manage',
    'handbook.manage', 'community.moderate'
  ];
BEGIN
  SELECT role INTO current_role
  FROM public.profiles
  WHERE id = auth.uid();

  IF current_role = 'super_admin' THEN
    RETURN all_permissions;
  ELSIF current_role = 'admin' THEN
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

REVOKE ALL ON FUNCTION public.get_my_admin_permissions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_admin_permissions() TO authenticated;

-- Direct client updates may never alter privileged profile fields. Dashboard SQL
-- and vetted SECURITY DEFINER functions execute as a trusted database role.
CREATE OR REPLACE FUNCTION public.protect_profile_privileged_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF (
    NEW.id IS DISTINCT FROM OLD.id
    OR NEW.role IS DISTINCT FROM OLD.role
    OR NEW.is_banned IS DISTINCT FROM OLD.is_banned
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  ) AND current_user NOT IN ('postgres', 'service_role', 'supabase_admin') THEN
    RAISE EXCEPTION 'Privileged profile fields can only be changed by an authorized server operation.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_privileged_fields ON public.profiles;
CREATE TRIGGER protect_profile_privileged_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_privileged_fields();

DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;

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
    'handbook.manage', 'community.moderate'
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

REVOKE ALL ON FUNCTION public.super_admin_set_admin_access(UUID, BOOLEAN, TEXT[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.super_admin_set_admin_access(UUID, BOOLEAN, TEXT[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_moderate_user(target_user_id UUID, moderation_action TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  caller_role TEXT;
  target_role TEXT;
  generated_name TEXT;
BEGIN
  IF NOT public.has_admin_permission('users.moderate') THEN
    RAISE EXCEPTION 'User moderation permission is required.';
  END IF;

  SELECT role INTO caller_role FROM public.profiles WHERE id = auth.uid();
  SELECT role INTO target_role FROM public.profiles WHERE id = target_user_id FOR UPDATE;

  IF target_role IS NULL THEN
    RAISE EXCEPTION 'Target user does not exist.';
  END IF;
  IF target_role = 'super_admin' THEN
    RAISE EXCEPTION 'Super administrators are protected and can only be changed from the Supabase Dashboard.';
  END IF;
  IF caller_role <> 'super_admin' AND target_role <> 'student' THEN
    RAISE EXCEPTION 'Administrators may only moderate regular users.';
  END IF;

  CASE moderation_action
    WHEN 'clear_avatar' THEN
      UPDATE public.profiles SET avatar_url = NULL WHERE id = target_user_id;
      RETURN NULL;
    WHEN 'reset_name' THEN
      generated_name := '用户_' || (floor(random() * 90000) + 10000)::INTEGER::TEXT;
      UPDATE public.profiles SET name = generated_name WHERE id = target_user_id;
      RETURN generated_name;
    WHEN 'ban' THEN
      UPDATE public.profiles SET is_banned = TRUE WHERE id = target_user_id;
      RETURN NULL;
    WHEN 'unban' THEN
      UPDATE public.profiles SET is_banned = FALSE WHERE id = target_user_id;
      RETURN NULL;
    ELSE
      RAISE EXCEPTION 'Unknown moderation action.';
  END CASE;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_moderate_user(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_moderate_user(UUID, TEXT) TO authenticated;

DROP FUNCTION IF EXISTS public.admin_get_users();
CREATE FUNCTION public.admin_get_users()
RETURNS TABLE (
  id UUID,
  name TEXT,
  avatar_url TEXT,
  email TEXT,
  role TEXT,
  push_token TEXT,
  is_banned BOOLEAN,
  permissions TEXT[],
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  IF NOT (
    public.has_admin_permission('users.moderate')
    OR public.has_admin_permission('users.delete')
    OR EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin')
  ) THEN
    RAISE EXCEPTION 'User management permission is required.';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.name,
    p.avatar_url,
    u.email::TEXT,
    p.role,
    p.push_token,
    p.is_banned,
    COALESCE(
      (SELECT array_agg(ap.permission ORDER BY ap.permission)
       FROM public.admin_permissions ap
       WHERE ap.admin_id = p.id),
      ARRAY[]::TEXT[]
    ),
    p.created_at
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  ORDER BY
    CASE p.role WHEN 'super_admin' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END,
    p.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_users() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_users() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_delete_user(target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  caller_role TEXT;
  target_role TEXT;
BEGIN
  IF NOT public.has_admin_permission('users.delete') THEN
    RAISE EXCEPTION 'User deletion permission is required.';
  END IF;

  SELECT role INTO caller_role FROM public.profiles WHERE id = auth.uid();
  SELECT role INTO target_role FROM public.profiles WHERE id = target_user_id;

  IF target_role IS NULL THEN
    RAISE EXCEPTION 'Target user does not exist.';
  END IF;
  IF target_role = 'super_admin' THEN
    RAISE EXCEPTION 'Super administrators cannot be deleted from the App.';
  END IF;
  IF caller_role <> 'super_admin' AND target_role <> 'student' THEN
    RAISE EXCEPTION 'Administrators may only delete regular users.';
  END IF;

  DELETE FROM auth.users WHERE id = target_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_user(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(UUID) TO authenticated;

-- Replace role-wide access with operation-specific permissions.
DROP POLICY IF EXISTS "Admins can manage articles" ON public.articles;
DROP POLICY IF EXISTS "Authorized admins can manage articles" ON public.articles;
CREATE POLICY "Authorized admins can manage articles" ON public.articles
  FOR ALL TO authenticated
  USING (public.has_admin_permission('articles.manage'))
  WITH CHECK (public.has_admin_permission('articles.manage'));

DROP POLICY IF EXISTS "Admins can manage notifications" ON public.notifications;
DROP POLICY IF EXISTS "Authorized admins can publish notifications" ON public.notifications;
DROP POLICY IF EXISTS "Authorized admins can update notifications" ON public.notifications;
DROP POLICY IF EXISTS "Authorized admins can delete notifications" ON public.notifications;
CREATE POLICY "Authorized admins can publish notifications" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (public.has_admin_permission('notifications.publish'));
CREATE POLICY "Authorized admins can update notifications" ON public.notifications
  FOR UPDATE TO authenticated
  USING (public.has_admin_permission('notifications.manage'))
  WITH CHECK (public.has_admin_permission('notifications.manage'));
CREATE POLICY "Authorized admins can delete notifications" ON public.notifications
  FOR DELETE TO authenticated
  USING (public.has_admin_permission('notifications.manage'));

DROP POLICY IF EXISTS "Admins can manage feedbacks" ON public.feedbacks;
DROP POLICY IF EXISTS "Only admins can update feedback" ON public.feedbacks;
DROP POLICY IF EXISTS "Only admins can view feedback" ON public.feedbacks;
DROP POLICY IF EXISTS "Authorized admins can manage feedbacks" ON public.feedbacks;
CREATE POLICY "Authorized admins can manage feedbacks" ON public.feedbacks
  FOR ALL TO authenticated
  USING (public.has_admin_permission('feedback.manage'))
  WITH CHECK (public.has_admin_permission('feedback.manage'));

-- The existing user UPDATE policy is intended only for marking a reply as viewed.
-- Prevent users from forging administrator replies, statuses, or feedback content.
CREATE OR REPLACE FUNCTION public.protect_feedback_admin_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF (to_jsonb(NEW) - 'user_viewed_reply') IS DISTINCT FROM (to_jsonb(OLD) - 'user_viewed_reply')
     AND NOT public.has_admin_permission('feedback.manage') THEN
    RAISE EXCEPTION 'Users may only update whether they have viewed an administrator reply.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_feedback_admin_fields ON public.feedbacks;
CREATE TRIGGER protect_feedback_admin_fields
  BEFORE UPDATE ON public.feedbacks
  FOR EACH ROW EXECUTE FUNCTION public.protect_feedback_admin_fields();

DROP POLICY IF EXISTS "Admins can manage events" ON public.events;
DROP POLICY IF EXISTS "Authorized admins can manage events" ON public.events;
CREATE POLICY "Authorized admins can manage events" ON public.events
  FOR ALL TO authenticated
  USING (public.has_admin_permission('events.manage'))
  WITH CHECK (public.has_admin_permission('events.manage'));

DROP POLICY IF EXISTS "Admins can view all registrations" ON public.event_registrations;
DROP POLICY IF EXISTS "Authorized admins can view all registrations" ON public.event_registrations;
CREATE POLICY "Authorized admins can view all registrations" ON public.event_registrations
  FOR SELECT TO authenticated
  USING (public.has_admin_permission('events.manage'));

DROP POLICY IF EXISTS "Admins can manage handbook" ON public.handbook_chapters;
-- These permissive policies were added manually to the live project and would
-- otherwise expose drafts and allow every signed-in user to edit the handbook.
DROP POLICY IF EXISTS "Allow public read access" ON public.handbook_chapters;
DROP POLICY IF EXISTS "Allow write access for authenticated users" ON public.handbook_chapters;
DROP POLICY IF EXISTS "Authorized admins can manage handbook" ON public.handbook_chapters;
CREATE POLICY "Authorized admins can manage handbook" ON public.handbook_chapters
  FOR ALL TO authenticated
  USING (public.has_admin_permission('handbook.manage'))
  WITH CHECK (public.has_admin_permission('handbook.manage'));

DROP POLICY IF EXISTS "Admins or author can delete posts" ON public.community_posts;
DROP POLICY IF EXISTS "Authorized admins or author can delete posts" ON public.community_posts;
CREATE POLICY "Authorized admins or author can delete posts" ON public.community_posts
  FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.has_admin_permission('community.moderate'));

-- The covers bucket is shared by article and notification administration.
DROP POLICY IF EXISTS "Allow authenticated upload to covers" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated delete from covers" ON storage.objects;
DROP POLICY IF EXISTS "Authorized admins can upload covers" ON storage.objects;
DROP POLICY IF EXISTS "Authorized admins can delete covers" ON storage.objects;
CREATE POLICY "Authorized admins can upload covers" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'covers'
    AND (
      public.has_admin_permission('articles.manage')
      OR public.has_admin_permission('notifications.publish')
      OR public.has_admin_permission('notifications.manage')
      OR name LIKE 'feedback-%'
    )
  );
CREATE POLICY "Authorized admins can delete covers" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'covers'
    AND (
      public.has_admin_permission('articles.manage')
      OR public.has_admin_permission('notifications.manage')
    )
  );

-- Push tokens must not be readable through the broad registration policy.
DROP POLICY IF EXISTS "Allow anyone to register or update their own push token" ON public.push_tokens;
DROP POLICY IF EXISTS "Admins can select all push tokens" ON public.push_tokens;
DROP POLICY IF EXISTS "Notification publishers can read push tokens" ON public.push_tokens;
CREATE POLICY "Notification publishers can read push tokens" ON public.push_tokens
  FOR SELECT TO authenticated
  USING (public.has_admin_permission('notifications.publish'));

CREATE OR REPLACE FUNCTION public.register_push_token(device_token TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF device_token IS NULL OR length(trim(device_token)) < 10 OR length(device_token) > 512 THEN
    RAISE EXCEPTION 'Invalid push token.';
  END IF;

  INSERT INTO public.push_tokens (user_id, token, updated_at)
  VALUES (auth.uid(), device_token, now())
  ON CONFLICT (token) DO UPDATE
  SET user_id = COALESCE(auth.uid(), public.push_tokens.user_id),
      updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.register_push_token(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_push_token(TEXT) TO anon, authenticated;
