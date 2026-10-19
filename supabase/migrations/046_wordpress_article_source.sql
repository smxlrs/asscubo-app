-- Preserve original article IDs, category, pinning, publication state and timestamps.
BEGIN;
ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS original_link TEXT,
  ADD COLUMN IF NOT EXISTS wordpress_post_id BIGINT;
CREATE UNIQUE INDEX IF NOT EXISTS articles_wordpress_post_id_key
  ON public.articles (wordpress_post_id) WHERE wordpress_post_id IS NOT NULL;
COMMENT ON COLUMN public.articles.original_link IS 'Original WeChat URL retained when the reading link moves to asscubo.it.';
COMMENT ON COLUMN public.articles.wordpress_post_id IS 'Stable asscubo.it WordPress post ID; does not replace the original source ID.';

-- One-time cutoff: historical imports must not send new-article push notifications.
CREATE TABLE IF NOT EXISTS public.article_source_settings (
  singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
  wordpress_push_after TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.article_source_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.article_source_settings FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.article_source_settings TO service_role;
INSERT INTO public.article_source_settings (singleton) VALUES (TRUE)
  ON CONFLICT (singleton) DO NOTHING;
COMMIT;
