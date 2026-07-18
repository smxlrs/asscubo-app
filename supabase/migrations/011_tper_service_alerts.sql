-- Official TPER service-change notices, normalized from the public Bologna RSS feed.
CREATE TABLE public.tper_service_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  source_url TEXT NOT NULL,
  published_at TIMESTAMPTZ,
  effective_period TEXT,
  affected_lines TEXT[] NOT NULL DEFAULT '{}',
  location TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX tper_service_alerts_expires_at_idx ON public.tper_service_alerts (expires_at DESC);
CREATE INDEX tper_service_alerts_published_at_idx ON public.tper_service_alerts (published_at DESC);

ALTER TABLE public.tper_service_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "TPER service alerts are publicly readable"
  ON public.tper_service_alerts
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- This row lets the edge function avoid repeatedly downloading the same RSS feed.
CREATE TABLE public.tper_alert_sync_state (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  last_success_at TIMESTAMPTZ,
  last_error TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
