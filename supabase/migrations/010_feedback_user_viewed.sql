-- 1. Add user_viewed_reply column to feedbacks table
ALTER TABLE public.feedbacks ADD COLUMN IF NOT EXISTS user_viewed_reply BOOLEAN DEFAULT false;

-- 2. Add UPDATE policy for authenticated users to update their own feedbacks (specifically for marking replies as viewed)
DROP POLICY IF EXISTS "Users can update own feedbacks" ON public.feedbacks;
CREATE POLICY "Users can update own feedbacks" ON public.feedbacks
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid() 
    OR email = (auth.jwt() ->> 'email')
  )
  WITH CHECK (
    user_id = auth.uid() 
    OR email = (auth.jwt() ->> 'email')
  );
