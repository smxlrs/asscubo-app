-- Statistics only. No existing business table triggers or automatic grants.
BEGIN;
ALTER TABLE public.admin_permissions DROP CONSTRAINT IF EXISTS admin_permissions_permission_check;
ALTER TABLE public.admin_permissions ADD CONSTRAINT admin_permissions_permission_check CHECK(permission IN (
  'feedback.manage','articles.sync','articles.manage','notifications.publish','notifications.manage',
  'users.moderate','users.delete','events.manage','handbook.manage','community.moderate','cssa_card.manage',
  'analytics.summary','analytics.users'
));
-- Extend the current permission lists without changing the existing grant logic.
DO $permissions$
DECLARE signature TEXT; definition TEXT;
BEGIN
  FOREACH signature IN ARRAY ARRAY['public.get_my_admin_permissions()', 'public.super_admin_set_admin_access(uuid,boolean,text[])'] LOOP
    definition := pg_get_functiondef(signature::regprocedure);
    IF position('''analytics.summary''' IN definition) = 0 THEN
      IF position('''cssa_card.manage''' IN definition) = 0 THEN
        RAISE EXCEPTION 'Install migration 016 before analytics permissions';
      END IF;
      EXECUTE replace(definition, '''cssa_card.manage''', '''cssa_card.manage'', ''analytics.summary'', ''analytics.users''');
    END IF;
  END LOOP;
END;
$permissions$;

CREATE TABLE IF NOT EXISTS public.tool_usage_settings (
  singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK(singleton),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);
INSERT INTO public.tool_usage_settings(singleton) VALUES(TRUE) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS public.tool_usage_sessions (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID NOT NULL,
  tool TEXT NOT NULL CHECK(tool IN ('bus','train','dictionary','rate','classroom','studyroom','handbook','events')),
  started_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL,
  duration_ms BIGINT NOT NULL CHECK(duration_ms BETWEEN 0 AND 21600000),
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id,session_id),
  CHECK(last_seen_at >= started_at)
);
CREATE INDEX IF NOT EXISTS tool_usage_started_idx ON public.tool_usage_sessions(started_at DESC,tool);
CREATE INDEX IF NOT EXISTS tool_usage_user_started_idx ON public.tool_usage_sessions(user_id,started_at DESC);
CREATE INDEX IF NOT EXISTS tool_usage_received_idx ON public.tool_usage_sessions(user_id,received_at DESC);
ALTER TABLE public.tool_usage_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tool_usage_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tool_usage_sessions,public.tool_usage_settings FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.tool_usage_collection_status()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT COALESCE((SELECT s.enabled FROM public.tool_usage_settings s WHERE singleton),FALSE)
    AND EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND is_banned IS NOT TRUE);
$$;
REVOKE ALL ON FUNCTION public.tool_usage_collection_status() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tool_usage_collection_status() TO authenticated;

CREATE OR REPLACE FUNCTION public.super_admin_set_tool_usage_collection(p_enabled BOOLEAN)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM profiles WHERE id=auth.uid() AND role='super_admin' AND is_banned IS NOT TRUE) THEN
    RAISE EXCEPTION 'Only a super administrator can change analytics collection.' USING ERRCODE='42501';
  END IF;
  IF p_enabled IS NULL THEN RAISE EXCEPTION 'Collection state is required'; END IF;
  UPDATE tool_usage_settings SET enabled=p_enabled,updated_at=now(),updated_by=auth.uid() WHERE singleton;
END;
$$;
REVOKE ALL ON FUNCTION public.super_admin_set_tool_usage_collection(BOOLEAN) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.super_admin_set_tool_usage_collection(BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION public.record_tool_usage(p_sessions JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='100ms' AS $$
DECLARE caller UUID:=auth.uid(); entry JSONB; item public.tool_usage_sessions%ROWTYPE;
  accepted UUID[]:='{}'::UUID[]; daily_count INTEGER;
BEGIN
  IF NOT public.tool_usage_collection_status() THEN RETURN jsonb_build_object('enabled',FALSE,'accepted',accepted); END IF;
  IF jsonb_typeof(p_sessions) IS DISTINCT FROM 'array' OR jsonb_array_length(p_sessions)>20 THEN
    RAISE EXCEPTION 'A batch must contain at most 20 sessions';
  END IF;
  -- Never queue behind another statistics write or lock a business/profile row.
  IF NOT pg_try_advisory_xact_lock(hashtextextended('tool-usage:'||caller::TEXT,0)) THEN
    RETURN jsonb_build_object('enabled',TRUE,'accepted',accepted);
  END IF;
  SELECT count(*) INTO daily_count FROM tool_usage_sessions WHERE user_id=caller AND received_at>=date_trunc('day',now());
  FOR entry IN SELECT value FROM jsonb_array_elements(p_sessions) LOOP
    item.session_id := (entry->>'session_id')::UUID;
    item.tool := entry->>'tool';
    item.started_at := (entry->>'started_at')::TIMESTAMPTZ;
    item.last_seen_at := (entry->>'last_seen_at')::TIMESTAMPTZ;
    item.duration_ms := (entry->>'duration_ms')::BIGINT;
    IF item.session_id IS NULL OR item.tool IS NULL OR item.tool NOT IN ('bus','train','dictionary','rate','classroom','studyroom','handbook','events')
      OR item.started_at IS NULL OR item.last_seen_at IS NULL OR item.duration_ms IS NULL
      OR item.started_at<now()-interval '90 days' OR item.started_at>now()+interval '5 minutes'
      OR item.last_seen_at<item.started_at OR item.last_seen_at>now()+interval '5 minutes'
      OR item.duration_ms<0 OR item.duration_ms>21600000
      OR item.duration_ms>extract(epoch FROM (item.last_seen_at-item.started_at))*1000+1000 THEN
      RAISE EXCEPTION 'Invalid usage snapshot';
    END IF;
    IF NOT EXISTS(SELECT 1 FROM tool_usage_sessions WHERE user_id=caller AND session_id=item.session_id) THEN
      IF daily_count>=1000 THEN CONTINUE; END IF;
      daily_count:=daily_count+1;
    END IF;
    INSERT INTO tool_usage_sessions(user_id,session_id,tool,started_at,last_seen_at,duration_ms)
      VALUES(caller,item.session_id,item.tool,item.started_at,item.last_seen_at,item.duration_ms)
    ON CONFLICT(user_id,session_id) DO UPDATE SET
      last_seen_at=GREATEST(tool_usage_sessions.last_seen_at,EXCLUDED.last_seen_at),
      duration_ms=GREATEST(tool_usage_sessions.duration_ms,EXCLUDED.duration_ms)
    WHERE tool_usage_sessions.tool=EXCLUDED.tool AND tool_usage_sessions.started_at=EXCLUDED.started_at;
    IF FOUND THEN accepted:=array_append(accepted,item.session_id); END IF;
  END LOOP;
  RETURN jsonb_build_object('enabled',TRUE,'accepted',accepted);
END;
$$;
REVOKE ALL ON FUNCTION public.record_tool_usage(JSONB) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.record_tool_usage(JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION public.require_tool_usage_access(p_permission TEXT,p_from TIMESTAMPTZ,p_to TIMESTAMPTZ)
RETURNS VOID LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF NOT public.has_admin_permission(p_permission) OR NOT EXISTS(SELECT 1 FROM profiles WHERE id=auth.uid() AND is_banned IS NOT TRUE) THEN
    RAISE EXCEPTION 'Analytics permission is required.' USING ERRCODE='42501';
  END IF;
  IF p_from IS NULL OR p_to IS NULL OR p_to<=p_from OR p_to-p_from>interval '90 days'
    OR p_to>now()+interval '1 day' OR p_from<now()-interval '91 days' THEN
    RAISE EXCEPTION 'Choose a range of up to 90 days';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.require_tool_usage_access(TEXT,TIMESTAMPTZ,TIMESTAMPTZ) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.admin_tool_usage_summary(p_from TIMESTAMPTZ,p_to TIMESTAMPTZ)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE result JSONB;
BEGIN
  PERFORM public.require_tool_usage_access('analytics.summary',p_from,p_to);
  WITH visits AS MATERIALIZED (
    SELECT * FROM tool_usage_sessions WHERE started_at>=p_from AND started_at<p_to AND started_at>=now()-interval '90 days'
  ) SELECT jsonb_build_object(
    'collection_enabled',(SELECT enabled FROM tool_usage_settings WHERE singleton),
    'total_registered',(SELECT count(*) FROM auth.users),
    'new_registered',(SELECT count(*) FROM auth.users WHERE created_at>=p_from AND created_at<p_to),
    'totals',(SELECT jsonb_build_object('visits',count(*),'users',count(DISTINCT user_id),'duration_ms',COALESCE(sum(duration_ms),0)) FROM visits),
    'tools',COALESCE((SELECT jsonb_agg(to_jsonb(t)) FROM (
      SELECT tool,count(*) AS visits,count(DISTINCT user_id) AS users,sum(duration_ms) AS duration_ms,max(last_seen_at) AS last_used_at
      FROM visits GROUP BY tool ORDER BY count(*) DESC,tool) t),'[]'::JSONB),
    'daily',COALESCE((SELECT jsonb_agg(to_jsonb(d)) FROM (
      SELECT (started_at AT TIME ZONE 'Europe/Rome')::DATE AS day,count(*) AS visits,count(DISTINCT user_id) AS users,sum(duration_ms) AS duration_ms
      FROM visits GROUP BY 1 ORDER BY 1) d),'[]'::JSONB)
  ) INTO result;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_tool_usage_summary(TIMESTAMPTZ,TIMESTAMPTZ) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_tool_usage_summary(TIMESTAMPTZ,TIMESTAMPTZ) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_tool_usage_users(p_from TIMESTAMPTZ,p_to TIMESTAMPTZ,
  p_search TEXT DEFAULT '',p_offset INTEGER DEFAULT 0,p_limit INTEGER DEFAULT 50)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE result JSONB;
BEGIN
  PERFORM public.require_tool_usage_access('analytics.users',p_from,p_to);
  WITH usage AS (
    SELECT user_id,count(*) AS visits,sum(duration_ms) AS duration_ms,max(last_seen_at) AS last_used_at
    FROM tool_usage_sessions WHERE started_at>=p_from AND started_at<p_to AND started_at>=now()-interval '90 days' GROUP BY user_id
  ), users AS MATERIALIZED (
    SELECT u.id,p.name,u.email::TEXT,u.created_at AS registered_at,u.last_sign_in_at,
      COALESCE(s.visits,0) AS visits,COALESCE(s.duration_ms,0) AS duration_ms,s.last_used_at
    FROM auth.users u LEFT JOIN profiles p ON p.id=u.id LEFT JOIN usage s ON s.user_id=u.id
    WHERE COALESCE(btrim(p_search),'')='' OR strpos(lower(COALESCE(p.name,'')),lower(btrim(p_search)))>0
      OR strpos(lower(COALESCE(u.email,'')),lower(btrim(p_search)))>0
  ) SELECT jsonb_build_object('total',(SELECT count(*) FROM users),
    'users',COALESCE((SELECT jsonb_agg(to_jsonb(t)) FROM (
      SELECT * FROM users ORDER BY visits DESC,registered_at DESC,id LIMIT LEAST(GREATEST(p_limit,1),50) OFFSET GREATEST(p_offset,0)
    ) t),'[]'::JSONB)) INTO result;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_tool_usage_users(TIMESTAMPTZ,TIMESTAMPTZ,TEXT,INTEGER,INTEGER) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_tool_usage_users(TIMESTAMPTZ,TIMESTAMPTZ,TEXT,INTEGER,INTEGER) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_tool_usage_user(p_user_id UUID,p_from TIMESTAMPTZ,p_to TIMESTAMPTZ,
  p_offset INTEGER DEFAULT 0,p_limit INTEGER DEFAULT 50)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE result JSONB;
BEGIN
  PERFORM public.require_tool_usage_access('analytics.users',p_from,p_to);
  WITH visits AS MATERIALIZED (
    SELECT * FROM tool_usage_sessions WHERE user_id=p_user_id AND started_at>=p_from AND started_at<p_to AND started_at>=now()-interval '90 days'
  ) SELECT jsonb_build_object(
    'user',(SELECT jsonb_build_object('id',u.id,'name',p.name,'email',u.email,'registered_at',u.created_at,'last_sign_in_at',u.last_sign_in_at)
      FROM auth.users u LEFT JOIN profiles p ON p.id=u.id WHERE u.id=p_user_id),
    'totals',(SELECT jsonb_build_object('visits',count(*),'duration_ms',COALESCE(sum(duration_ms),0)) FROM visits),
    'tools',COALESCE((SELECT jsonb_agg(to_jsonb(t)) FROM (
      SELECT tool,count(*) AS visits,sum(duration_ms) AS duration_ms,max(last_seen_at) AS last_used_at FROM visits GROUP BY tool ORDER BY count(*) DESC,tool
    ) t),'[]'::JSONB),
    'sessions',COALESCE((SELECT jsonb_agg(to_jsonb(t)) FROM (
      SELECT session_id,tool,started_at,last_seen_at,duration_ms FROM visits ORDER BY started_at DESC,session_id
      LIMIT LEAST(GREATEST(p_limit,1),50) OFFSET GREATEST(p_offset,0)
    ) t),'[]'::JSONB)
  ) INTO result;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_tool_usage_user(UUID,TIMESTAMPTZ,TIMESTAMPTZ,INTEGER,INTEGER) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_tool_usage_user(UUID,TIMESTAMPTZ,TIMESTAMPTZ,INTEGER,INTEGER) TO authenticated;

CREATE OR REPLACE FUNCTION public.prune_tool_usage()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE removed INTEGER;
BEGIN
  DELETE FROM tool_usage_sessions WHERE started_at<now()-interval '90 days';
  GET DIAGNOSTICS removed=ROW_COUNT;
  RETURN removed;
END;
$$;
REVOKE ALL ON FUNCTION public.prune_tool_usage() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prune_tool_usage() TO service_role;
DO $retention$
BEGIN
  IF to_regprocedure('cron.schedule(text,text,text)') IS NOT NULL THEN
    PERFORM cron.schedule('tool-usage-retention','23 3 * * *','SELECT public.prune_tool_usage();');
  END IF;
END;
$retention$;
NOTIFY pgrst,'reload schema';
COMMIT;
