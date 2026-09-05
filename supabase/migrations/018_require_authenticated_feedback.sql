-- Require authentication for all new feedback submissions.

DROP POLICY IF EXISTS "Allow anyone to insert feedback" ON public.feedbacks;
DROP POLICY IF EXISTS "Anyone can insert feedbacks" ON public.feedbacks;
CREATE POLICY "Authenticated users can insert own feedback"
  ON public.feedbacks
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can only view feedback explicitly linked to their authenticated account.
DROP POLICY IF EXISTS "Users can view own feedbacks" ON public.feedbacks;
CREATE POLICY "Users can view own feedbacks"
  ON public.feedbacks
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
