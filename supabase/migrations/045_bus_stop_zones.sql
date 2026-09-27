-- Live fare-zone metadata, using the existing transactional stop refresh.
BEGIN;
ALTER TABLE public.bus_stops ADD COLUMN IF NOT EXISTS zone_code TEXT;
ALTER TABLE public.tper_stop_sync_state ADD COLUMN IF NOT EXISTS stop_details_version TEXT;

CREATE OR REPLACE FUNCTION public.replace_bus_stops_with_zones(
  p_stops JSONB, p_gtfs_version TEXT, p_line_stops_version TEXT, p_stop_details_version TEXT
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE result JSONB;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN RAISE EXCEPTION 'service_role is required'; END IF;
  IF jsonb_typeof(p_stops) IS DISTINCT FROM 'array' OR NULLIF(trim(p_stop_details_version), '') IS NULL THEN
    RAISE EXCEPTION 'Invalid stop-zone payload';
  END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_stops) item WHERE NOT (item ? 'zone_code')) THEN
    RAISE EXCEPTION 'Each stop must include zone_code (or null)';
  END IF;
  result := public.replace_bus_stops_from_tper(p_stops, p_gtfs_version, p_line_stops_version);
  UPDATE public.bus_stops s SET zone_code = CASE
    WHEN trim(r.zone_code) ~ '^[1-9][0-9]*$' THEN trim(r.zone_code) ELSE NULL END
  FROM jsonb_to_recordset(p_stops) AS r(stop_code TEXT, zone_code TEXT)
  WHERE s.stop_code = trim(r.stop_code);
  UPDATE public.tper_stop_sync_state SET stop_details_version = p_stop_details_version WHERE id = 1;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.replace_bus_stops_with_zones(JSONB, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.replace_bus_stops_with_zones(JSONB, TEXT, TEXT, TEXT) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
