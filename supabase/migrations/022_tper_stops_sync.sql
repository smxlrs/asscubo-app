-- Transactional TPER bus-stop refresh, invoked by the tper-stops-sync Edge Function.
CREATE TABLE IF NOT EXISTS public.tper_stop_sync_state (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  gtfs_version TEXT,
  line_stops_version TEXT,
  stop_count INTEGER,
  last_attempt_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  last_error TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tper_stop_sync_state ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.bus_stops
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.replace_bus_stops_from_tper(
  p_stops JSONB,
  p_gtfs_version TEXT,
  p_line_stops_version TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  incoming_count INTEGER;
  previous_count INTEGER;
  removed_count INTEGER;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'service_role is required';
  END IF;

  IF jsonb_typeof(p_stops) <> 'array' THEN
    RAISE EXCEPTION 'p_stops must be a JSON array';
  END IF;

  incoming_count := jsonb_array_length(p_stops);
  IF incoming_count < 5000 OR incoming_count > 10000 THEN
    RAISE EXCEPTION 'Unexpected stop count: %', incoming_count;
  END IF;

  CREATE TEMP TABLE tper_staged_stops (
    stop_code TEXT PRIMARY KEY,
    stop_name TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    city TEXT NOT NULL,
    lines TEXT
  ) ON COMMIT DROP;

  INSERT INTO tper_staged_stops (stop_code, stop_name, latitude, longitude, city, lines)
  SELECT
    trim(record.stop_code),
    trim(record.stop_name),
    record.latitude,
    record.longitude,
    COALESCE(NULLIF(trim(record.city), ''), 'Bologna'),
    NULLIF(trim(record.lines), '')
  FROM jsonb_to_recordset(p_stops) AS record(
    stop_code TEXT,
    stop_name TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    city TEXT,
    lines TEXT
  );

  IF (SELECT count(*) FROM tper_staged_stops) <> incoming_count THEN
    RAISE EXCEPTION 'Duplicate or invalid stop codes in the TPER payload';
  END IF;

  IF EXISTS (
    SELECT 1 FROM tper_staged_stops
    WHERE stop_code = '' OR stop_name = ''
       OR latitude NOT BETWEEN -90 AND 90
       OR longitude NOT BETWEEN -180 AND 180
  ) THEN
    RAISE EXCEPTION 'Invalid stop data in the TPER payload';
  END IF;

  SELECT count(*) INTO previous_count FROM public.bus_stops;

  INSERT INTO public.bus_stops (stop_code, stop_name, latitude, longitude, city, lines, updated_at)
  SELECT stop_code, stop_name, latitude, longitude, city, lines, now()
  FROM tper_staged_stops
  ON CONFLICT (stop_code) DO UPDATE SET
    stop_name = EXCLUDED.stop_name,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    city = EXCLUDED.city,
    lines = EXCLUDED.lines,
    updated_at = EXCLUDED.updated_at;

  DELETE FROM public.bus_stops AS existing
  WHERE NOT EXISTS (
    SELECT 1 FROM tper_staged_stops AS staged
    WHERE staged.stop_code = existing.stop_code
  );
  GET DIAGNOSTICS removed_count = ROW_COUNT;

  INSERT INTO public.tper_stop_sync_state (
    id, gtfs_version, line_stops_version, stop_count,
    last_attempt_at, last_success_at, last_error, updated_at
  ) VALUES (
    1, p_gtfs_version, p_line_stops_version, incoming_count,
    now(), now(), NULL, now()
  )
  ON CONFLICT (id) DO UPDATE SET
    gtfs_version = EXCLUDED.gtfs_version,
    line_stops_version = EXCLUDED.line_stops_version,
    stop_count = EXCLUDED.stop_count,
    last_attempt_at = EXCLUDED.last_attempt_at,
    last_success_at = EXCLUDED.last_success_at,
    last_error = NULL,
    updated_at = EXCLUDED.updated_at;

  RETURN jsonb_build_object(
    'previousCount', previous_count,
    'currentCount', incoming_count,
    'removedCount', removed_count
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.replace_bus_stops_from_tper(JSONB, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.replace_bus_stops_from_tper(JSONB, TEXT, TEXT) TO service_role;

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

DO $schedule$
DECLARE
  existing_job_id BIGINT;
BEGIN
  SELECT jobid INTO existing_job_id
  FROM cron.job WHERE jobname = 'tper-stops-weekly-sync' LIMIT 1;
  IF existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job_id);
  END IF;

  IF EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'tper_alerts_secret_key') THEN
    PERFORM cron.schedule(
      'tper-stops-weekly-sync',
      '17 3 * * 1',
      $cron$
      SELECT net.http_post(
        url := 'https://avxzgaozbfeqttmhmlld.supabase.co/functions/v1/tper-stops-sync',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'apikey', (
            SELECT decrypted_secret FROM vault.decrypted_secrets
            WHERE name = 'tper_alerts_secret_key' LIMIT 1
          )
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 120000
      );
      $cron$
    );
  ELSE
    RAISE WARNING 'Vault secret tper_alerts_secret_key is missing; weekly stop sync was not scheduled.';
  END IF;
END;
$schedule$;
