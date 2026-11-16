BEGIN;

ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS admin_hidden BOOLEAN NOT NULL DEFAULT FALSE;

-- Keep the old is_published-based clients compatible. Sync uses service_role and
-- must never change the administrator's independent visibility decision.
CREATE OR REPLACE FUNCTION public.preserve_article_visibility()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND auth.role() = 'authenticated'
     AND public.has_admin_permission('articles.manage')
     AND NEW.is_published IS DISTINCT FROM OLD.is_published THEN
    NEW.admin_hidden := NOT NEW.is_published;
  END IF;
  IF NEW.admin_hidden THEN NEW.is_published := FALSE; END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS preserve_article_visibility ON public.articles;
CREATE TRIGGER preserve_article_visibility BEFORE INSERT OR UPDATE ON public.articles
FOR EACH ROW EXECUTE FUNCTION public.preserve_article_visibility();

-- Older Apps still have the old cleanup button. Protect source identities in
-- the database too; deleting them would turn the next sync into a new import.
CREATE OR REPLACE FUNCTION public.retain_website_article_identity()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF OLD.wordpress_post_id IS NOT NULL THEN
    RAISE EXCEPTION 'Website article identities must be retained. Hide the article instead.' USING ERRCODE = '42501';
  END IF;
  RETURN OLD;
END;
$$;
DROP TRIGGER IF EXISTS retain_website_article_identity ON public.articles;
CREATE TRIGGER retain_website_article_identity BEFORE DELETE ON public.articles
FOR EACH ROW EXECUTE FUNCTION public.retain_website_article_identity();

CREATE OR REPLACE FUNCTION public.activate_wordpress_articles(p_post_ids BIGINT[])
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE hidden_count INTEGER; activated_count INTEGER; expected_count INTEGER;
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
    WHERE is_published = TRUE AND (admin_hidden OR wordpress_post_id IS NULL OR NOT (wordpress_post_id = ANY(p_post_ids)));
  GET DIAGNOSTICS hidden_count = ROW_COUNT;
  UPDATE public.articles SET is_published = TRUE
    WHERE wordpress_post_id = ANY(p_post_ids) AND NOT admin_hidden AND is_published IS DISTINCT FROM TRUE;
  GET DIAGNOSTICS activated_count = ROW_COUNT;
  RETURN jsonb_build_object('archived', hidden_count, 'activated', activated_count,
    'visible', (SELECT count(*) FROM public.articles WHERE is_published AND NOT admin_hidden AND wordpress_post_id = ANY(p_post_ids)));
END;
$$;
REVOKE ALL ON FUNCTION public.activate_wordpress_articles(BIGINT[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_wordpress_articles(BIGINT[]) TO service_role;

-- SECURITY INVOKER deliberately preserves existing notification/event RLS.
-- Merge before limiting so older pinned items cannot be lost between sources.
CREATE OR REPLACE FUNCTION public.publication_feed(
  p_kind TEXT DEFAULT 'all', p_category TEXT DEFAULT 'all', p_search TEXT DEFAULT '',
  p_offset INTEGER DEFAULT 0, p_limit INTEGER DEFAULT 16
)
RETURNS TABLE(id UUID, title TEXT, summary TEXT, category TEXT, cover_image TEXT,
  created_at TIMESTAMPTZ, link TEXT, is_pinned BOOLEAN, type TEXT)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, pg_temp AS $$
  SELECT f.* FROM (
    SELECT a.id, a.title, a.summary, COALESCE(a.category, 'general') AS category,
      a.cover_image, a.created_at, a.link, COALESCE(a.is_pinned, FALSE) AS is_pinned, 'article'::TEXT AS type
    FROM public.articles a
    WHERE p_kind IN ('all', 'articles') AND a.is_published AND NOT a.admin_hidden
      AND (p_category = 'all' OR a.category = p_category OR
        (p_kind = 'all' AND a.category = CASE p_category WHEN 'events' THEN 'event_news' WHEN 'academic' THEN 'notice' WHEN 'life' THEN 'news' ELSE p_category END))
    UNION ALL
    SELECT n.id, n.title, n.content AS summary, COALESCE(n.category, 'general'),
      n.cover_image, n.created_at, n.link, COALESCE(n.is_pinned, FALSE), 'notification'::TEXT
    FROM public.notifications n
    WHERE p_kind = 'all' AND (p_category = 'all' OR COALESCE(n.category, 'general') = p_category)
      AND (n.target_type IS DISTINCT FROM 'user' OR n.target_value = auth.uid()::TEXT)
  ) f
  WHERE COALESCE(btrim(p_search), '') = ''
    OR strpos(lower(f.title), lower(btrim(p_search))) > 0
    OR strpos(lower(COALESCE(f.summary, '')), lower(btrim(p_search))) > 0
  ORDER BY f.is_pinned DESC, f.created_at DESC, f.id DESC, f.type DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 51) OFFSET GREATEST(p_offset, 0);
$$;
REVOKE ALL ON FUNCTION public.publication_feed(TEXT, TEXT, TEXT, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.publication_feed(TEXT, TEXT, TEXT, INTEGER, INTEGER) TO anon, authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
