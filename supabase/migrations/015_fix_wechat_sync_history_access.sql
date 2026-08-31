-- Keep the cached WeChat token service-role only. Sync history contains no token.
DROP POLICY IF EXISTS "Admins can read WeChat sync status" ON public.wechat_sync_state;
REVOKE SELECT ON TABLE public.wechat_sync_state FROM authenticated;

CREATE TABLE IF NOT EXISTS public.wechat_sync_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger TEXT NOT NULL DEFAULT 'automatic' CHECK (trigger IN ('automatic', 'manual')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'busy', 'error')),
  result JSONB NOT NULL DEFAULT '{}'::JSONB
);

CREATE INDEX IF NOT EXISTS wechat_sync_runs_started_at_idx
  ON public.wechat_sync_runs (started_at DESC);

ALTER TABLE public.wechat_sync_runs ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON TABLE public.wechat_sync_runs TO authenticated;

DROP POLICY IF EXISTS "Sync admins can read WeChat sync runs" ON public.wechat_sync_runs;
CREATE POLICY "Sync admins can read WeChat sync runs"
  ON public.wechat_sync_runs
  FOR SELECT
  TO authenticated
  USING (public.has_admin_permission('articles.sync'));
