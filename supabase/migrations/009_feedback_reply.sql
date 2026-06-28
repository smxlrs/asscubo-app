-- 1. Add user_id column to feedbacks table referencing profiles.id
ALTER TABLE public.feedbacks ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 2. Add reply, replied_at and replied_by_name columns to feedbacks table
ALTER TABLE public.feedbacks ADD COLUMN IF NOT EXISTS reply TEXT;
ALTER TABLE public.feedbacks ADD COLUMN IF NOT EXISTS replied_at TIMESTAMPTZ;
ALTER TABLE public.feedbacks ADD COLUMN IF NOT EXISTS replied_by_name TEXT;

-- 3. Enable RLS and setup policies for security
ALTER TABLE public.feedbacks ENABLE ROW LEVEL SECURITY;

-- Policy A: Anyone can insert feedback
DROP POLICY IF EXISTS "Anyone can insert feedbacks" ON public.feedbacks;
CREATE POLICY "Anyone can insert feedbacks" ON public.feedbacks
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Policy B: Authenticated users can view their own feedbacks (by user_id or email)
DROP POLICY IF EXISTS "Users can view own feedbacks" ON public.feedbacks;
CREATE POLICY "Users can view own feedbacks" ON public.feedbacks
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid() 
    OR email = (auth.jwt() ->> 'email')
  );

-- Policy C: Admins and super_admins can manage all feedbacks
DROP POLICY IF EXISTS "Admins can manage feedbacks" ON public.feedbacks;
CREATE POLICY "Admins can manage feedbacks" ON public.feedbacks
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
        AND profiles.role IN ('admin', 'super_admin')
    )
  );
