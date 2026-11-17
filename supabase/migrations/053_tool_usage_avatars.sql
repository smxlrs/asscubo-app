-- Add profile avatars to the existing permission-checked analytics reports.
BEGIN;
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
    SELECT u.id,p.name,p.avatar_url,u.email::TEXT,u.created_at AS registered_at,u.last_sign_in_at,
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
    'user',(SELECT jsonb_build_object('id',u.id,'name',p.name,'avatar_url',p.avatar_url,'email',u.email,'registered_at',u.created_at,'last_sign_in_at',u.last_sign_in_at)
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

NOTIFY pgrst,'reload schema';
COMMIT;
