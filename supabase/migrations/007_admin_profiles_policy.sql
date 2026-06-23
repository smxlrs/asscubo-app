-- Allow admins and super_admins to update user profiles (e.g. to clear violating avatars or reset nicknames)
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;

CREATE POLICY "Admins can update all profiles" ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
        AND profiles.role IN ('admin', 'super_admin')
    )
  );
