-- Security hardening for production clients.

-- The app's public client must never be able to upload arbitrary files anonymously.
DROP POLICY IF EXISTS "Allow anon upload to covers" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated upload to covers" ON storage.objects;
CREATE POLICY "Authenticated users can upload to covers"
  ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'covers');

-- Users only need a narrow operation to mark their own feedback replies as viewed.
DROP POLICY IF EXISTS "Users can update own feedbacks" ON public.feedbacks;
DROP FUNCTION IF EXISTS public.mark_feedback_reply_viewed(UUID);
CREATE FUNCTION public.mark_feedback_reply_viewed(p_feedback_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.feedbacks
  SET user_viewed_reply = TRUE
  WHERE id = p_feedback_id
    AND (user_id = auth.uid() OR email = (auth.jwt() ->> 'email'));
END;
$$;

REVOKE ALL ON FUNCTION public.mark_feedback_reply_viewed(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_feedback_reply_viewed(UUID) TO authenticated;
