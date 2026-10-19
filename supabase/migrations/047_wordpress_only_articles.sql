-- Activate the complete website article set in one transaction. Legacy records are retained.
CREATE OR REPLACE FUNCTION public.activate_wordpress_articles(p_post_ids BIGINT[])
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  hidden_count INTEGER;
  activated_count INTEGER;
  expected_count INTEGER;
BEGIN
  IF p_post_ids IS NULL OR EXISTS (SELECT 1 FROM unnest(p_post_ids) x WHERE x IS NULL OR x <= 0) THEN
    RAISE EXCEPTION 'Invalid WordPress post IDs';
  END IF;
  SELECT count(DISTINCT x) INTO expected_count FROM unnest(p_post_ids) x;
  IF expected_count <> cardinality(p_post_ids) THEN RAISE EXCEPTION 'Duplicate WordPress post IDs'; END IF;
  IF (SELECT count(*) FROM public.articles WHERE wordpress_post_id = ANY(p_post_ids) AND link LIKE 'https://asscubo.it/%') <> expected_count THEN
    RAISE EXCEPTION 'Website articles are not completely staged';
  END IF;
  UPDATE public.articles SET is_published = FALSE
    WHERE is_published = TRUE AND (wordpress_post_id IS NULL OR NOT (wordpress_post_id = ANY(p_post_ids)));
  GET DIAGNOSTICS hidden_count = ROW_COUNT;
  UPDATE public.articles SET is_published = TRUE
    WHERE wordpress_post_id = ANY(p_post_ids) AND is_published IS DISTINCT FROM TRUE;
  GET DIAGNOSTICS activated_count = ROW_COUNT;
  RETURN jsonb_build_object('archived', hidden_count, 'activated', activated_count, 'visible', expected_count);
END;
$$;
REVOKE ALL ON FUNCTION public.activate_wordpress_articles(BIGINT[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_wordpress_articles(BIGINT[]) TO service_role;
