-- Persistent state and stable source keys for reliable WeChat synchronization.

ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS source TEXT,
  ADD COLUMN IF NOT EXISTS source_id TEXT;

COMMENT ON COLUMN public.articles.source IS 'External source identifier, for example wechat.';
COMMENT ON COLUMN public.articles.source_id IS 'Stable identifier supplied by the external source.';

CREATE UNIQUE INDEX IF NOT EXISTS articles_source_source_id_key
  ON public.articles (source, source_id)
  WHERE source IS NOT NULL AND source_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.wechat_sync_state (
  singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
  access_token TEXT,
  access_token_expires_at TIMESTAMPTZ,
  lock_until TIMESTAMPTZ,
  last_started_at TIMESTAMPTZ,
  last_completed_at TIMESTAMPTZ,
  last_result JSONB NOT NULL DEFAULT '{}'::JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.wechat_sync_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.wechat_sync_state FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.wechat_sync_state TO service_role;

INSERT INTO public.wechat_sync_state (singleton)
VALUES (TRUE)
ON CONFLICT (singleton) DO NOTHING;

CREATE OR REPLACE FUNCTION public.claim_wechat_sync_run(lock_for_seconds INTEGER DEFAULT 180)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  claimed BOOLEAN := FALSE;
  bounded_seconds INTEGER := LEAST(GREATEST(COALESCE(lock_for_seconds, 180), 30), 600);
BEGIN
  UPDATE public.wechat_sync_state
  SET lock_until = now() + make_interval(secs => bounded_seconds),
      last_started_at = now(),
      updated_at = now()
  WHERE singleton = TRUE
    AND (lock_until IS NULL OR lock_until < now())
  RETURNING TRUE INTO claimed;

  RETURN COALESCE(claimed, FALSE);
END;
$$;

CREATE OR REPLACE FUNCTION public.finish_wechat_sync_run(sync_result JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.wechat_sync_state
  SET lock_until = NULL,
      last_completed_at = now(),
      last_result = COALESCE(sync_result, '{}'::JSONB),
      updated_at = now()
  WHERE singleton = TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_wechat_sync_run(INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finish_wechat_sync_run(JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_wechat_sync_run(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_wechat_sync_run(JSONB) TO service_role;
