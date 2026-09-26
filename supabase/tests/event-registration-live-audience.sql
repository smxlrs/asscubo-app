-- Exact random fixtures only. No push dispatch, HTTP or email. Keep ROLLBACK.
BEGIN;
SET LOCAL statement_timeout = '90s';
SET LOCAL lock_timeout = '5s';
CREATE TEMP TABLE audience_results(test TEXT, passed BOOLEAN, details JSONB DEFAULT '{}'::JSONB);
DO $$ BEGIN
  EXECUTE format('GRANT USAGE ON SCHEMA %I TO authenticated, anon',
    (SELECT nspname FROM pg_namespace WHERE oid=pg_my_temp_schema()));
END $$;
GRANT INSERT ON pg_temp.audience_results TO authenticated, anon;
CREATE FUNCTION pg_temp.audience_check(label TEXT, ok BOOLEAN, detail JSONB DEFAULT '{}'::JSONB)
RETURNS VOID LANGUAGE plpgsql AS $$ BEGIN
  IF ok IS DISTINCT FROM TRUE THEN RAISE EXCEPTION 'Audience check failed: %',label; END IF;
  INSERT INTO pg_temp.audience_results VALUES(label,TRUE,detail);
END $$;
CREATE FUNCTION pg_temp.audience_actor(person UUID)
RETURNS VOID LANGUAGE plpgsql AS $$ BEGIN
  PERFORM set_config('request.jwt.claim.sub',COALESCE(person::TEXT,''),TRUE);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',person,'role',CASE WHEN person IS NULL THEN 'anon' ELSE 'authenticated' END)::TEXT,TRUE);
END $$;
REVOKE ALL ON FUNCTION pg_temp.audience_check(TEXT,BOOLEAN,JSONB), pg_temp.audience_actor(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION pg_temp.audience_check(TEXT,BOOLEAN,JSONB), pg_temp.audience_actor(UUID) TO authenticated, anon;

DO $test$
DECLARE run_id UUID:=gen_random_uuid(); users UUID[]:='{}'; events UUID[]:='{}'; person UUID;
  manager UUID; member UUID; student UUID; superuser_id UUID; num INTEGER;
  public_event UUID; internal_event UUID; draft_event UUID; registration_id UUID; row_data public.events%ROWTYPE;
  payload JSONB; version INTEGER; denied BOOLEAN; public_registration UUID; fixture_tokens TEXT[]:='{}';
BEGIN
  FOR num IN 1..4 LOOP
    person:=gen_random_uuid();
    INSERT INTO auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,
      created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change)
    VALUES(person,'authenticated','authenticated','audience-rollback-'||run_id||'-'||num||'@example.invalid','',clock_timestamp(),
      '{"provider":"email","providers":["email"]}',jsonb_build_object('name','Audience fixture '||num),clock_timestamp(),clock_timestamp(),'','','','');
    users:=array_append(users,person);
    UPDATE public.profiles SET role=CASE num WHEN 3 THEN 'student' WHEN 4 THEN 'super_admin' ELSE 'admin' END WHERE id=person;
    fixture_tokens:=array_append(fixture_tokens,'ExpoPushToken[audience_'||replace(person::TEXT,'-','')||']');
    INSERT INTO public.push_tokens(user_id,token) VALUES(person,fixture_tokens[num]);
  END LOOP;
  manager:=users[1]; member:=users[2]; student:=users[3]; superuser_id:=users[4];
  INSERT INTO public.admin_permissions(admin_id,permission,granted_by) VALUES(manager,'events.manage',manager);
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM pg_temp.audience_actor(manager);
  payload:=jsonb_build_object('title','[ROLLBACK AUDIENCE '||run_id||']','description','Isolated test',
    'start_time',clock_timestamp()+interval '29 days','end_time',clock_timestamp()+interval '30 days',
    'is_published',TRUE,'registration_status','open','registration_form','[]'::JSONB,
    'vehicle_selection_mode','none','registration_start_notify_enabled',FALSE);
  public_event:=public.admin_save_event_config(NULL,payload,'[]',NULL);
  internal_event:=public.admin_save_event_config(NULL,payload||'{"audience":"admins"}','[]',NULL);
  draft_event:=public.admin_save_event_config(NULL,payload||'{"audience":"admins","is_published":false}','[]',NULL);
  events:=ARRAY[public_event,internal_event,draft_event];
  PERFORM pg_temp.audience_check('new events default to all; administrator audience persists',
    (SELECT audience='all' FROM public.events WHERE id=public_event) AND (SELECT audience='admins' FROM public.events WHERE id=internal_event));
  SELECT * INTO row_data FROM public.events WHERE id=internal_event;
  PERFORM public.admin_save_event_config(internal_event,to_jsonb(row_data)-'audience','[]',row_data.revision);
  PERFORM pg_temp.audience_check('old payload omitting audience preserves internal visibility',
    (SELECT audience='admins' FROM public.events WHERE id=internal_event));
  denied:=FALSE;
  BEGIN
    PERFORM public.admin_save_event_config(internal_event,to_jsonb(row_data)||'{"audience":"all"}','[]',row_data.revision);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%Event changed%' THEN RAISE; END IF; denied:=TRUE;
  END;
  PERFORM pg_temp.audience_check('stale administrator page cannot change audience',denied);
  SELECT registration_form_version INTO version FROM public.events WHERE id=internal_event;

  EXECUTE 'SET LOCAL ROLE anon';
  PERFORM pg_temp.audience_actor(NULL);
  PERFORM pg_temp.audience_check('guest sees public activity but no internal activity',
    EXISTS(SELECT 1 FROM public.events WHERE id=public_event) AND NOT EXISTS(SELECT 1 FROM public.events WHERE id=internal_event));
  PERFORM pg_temp.audience_check('guest cannot call registration RPC',
    NOT has_function_privilege('anon','public.submit_event_registration_checked(uuid,text,text,integer,jsonb,jsonb,uuid,text,integer)','EXECUTE'));

  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM pg_temp.audience_actor(student);
  PERFORM pg_temp.audience_check('student sees no internal activity even by exact ID',NOT EXISTS(SELECT 1 FROM public.events WHERE id=internal_event));
  denied:=FALSE;
  BEGIN
    PERFORM * FROM public.submit_event_registration_checked(internal_event,'self',NULL,1,'{}','[{"name":"Fixture"}]',NULL,'app',version);
  EXCEPTION WHEN insufficient_privilege THEN denied:=TRUE;
  END;
  PERFORM pg_temp.audience_check('direct student submission to internal activity is denied',denied);
  denied:=FALSE;
  BEGIN
    PERFORM * FROM public.admin_event_push_tokens(internal_event);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%permission is required%' THEN RAISE; END IF; denied:=TRUE;
  END;
  PERFORM pg_temp.audience_check('student cannot read notification recipient tokens',denied);
  SELECT registration_form_version INTO version FROM public.events WHERE id=public_event;
  SELECT r.registration_id INTO public_registration FROM public.submit_event_registration_checked(public_event,'self',NULL,1,'{}','[{"name":"Fixture"}]',NULL,'app',version) r;
  PERFORM pg_temp.audience_check('signed-in student can register for public activity',public_registration IS NOT NULL);

  PERFORM pg_temp.audience_actor(member);
  PERFORM pg_temp.audience_check('admin without event-management permission sees published internal activity only',
    NOT public.has_admin_permission('events.manage') AND EXISTS(SELECT 1 FROM public.events WHERE id=internal_event)
    AND NOT EXISTS(SELECT 1 FROM public.events WHERE id=draft_event));
  SELECT registration_form_version INTO version FROM public.events WHERE id=internal_event;
  SELECT r.registration_id INTO registration_id FROM public.submit_event_registration_checked(internal_event,'self',NULL,1,'{}','[{"name":"Admin fixture"}]',NULL,'app',version) r;
  PERFORM pg_temp.audience_check('admin without event-management permission can register',registration_id IS NOT NULL);
  PERFORM pg_temp.audience_actor(superuser_id);
  PERFORM pg_temp.audience_check('super administrator can view internal activity',EXISTS(SELECT 1 FROM public.events WHERE id=internal_event));
  PERFORM pg_temp.audience_actor(manager);
  PERFORM pg_temp.audience_check('internal push includes fixture admins and excludes fixture student',
    (SELECT count(*) FROM public.admin_event_push_tokens(internal_event,0,500) r WHERE r.token=ANY(fixture_tokens))=3
    AND NOT EXISTS(SELECT 1 FROM public.admin_event_push_tokens(internal_event,0,500,student)));
  PERFORM pg_temp.audience_check('targeted internal push only returns selected administrator devices',
    EXISTS(SELECT 1 FROM public.admin_event_push_tokens(internal_event,0,500,member) r WHERE r.token=fixture_tokens[2]));
  SELECT * INTO row_data FROM public.events WHERE id=public_event;
  PERFORM public.admin_save_event_config(public_event,to_jsonb(row_data)||'{"audience":"admins"}','[]',row_data.revision);
  PERFORM pg_temp.audience_actor(student);
  PERFORM pg_temp.audience_check('changing audience hides former student registration and answers',
    NOT EXISTS(SELECT 1 FROM public.event_registrations WHERE id=public_registration)
    AND NOT EXISTS(SELECT 1 FROM public.event_registration_attendees WHERE event_registration_attendees.registration_id=public_registration));
  PERFORM pg_temp.audience_actor(manager);
  PERFORM pg_temp.audience_check('manager retains historical registrations',EXISTS(SELECT 1 FROM public.event_registrations WHERE id=public_registration));
  EXECUTE 'RESET ROLE';
  UPDATE public.profiles SET role='student' WHERE id=member;
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM pg_temp.audience_actor(member);
  PERFORM pg_temp.audience_check('demoted administrator loses internal activity access',NOT EXISTS(SELECT 1 FROM public.events WHERE id=internal_event));
  PERFORM pg_temp.audience_actor(manager);
  PERFORM pg_temp.audience_check('demoted administrator excluded from internal push',NOT EXISTS(SELECT 1 FROM public.admin_event_push_tokens(internal_event,0,500,member)));
  EXECUTE 'RESET ROLE';
  PERFORM pg_temp.audience_check('no fixture notification jobs or cron are created',
    NOT EXISTS(SELECT 1 FROM public.event_registration_notification_jobs WHERE event_id=ANY(events)));
  PERFORM pg_temp.audience_check('random fixture IDs for independent rollback verification',TRUE,
    jsonb_build_object('run_id',run_id,'event_ids',events,'user_ids',users));
END;
$test$;
SELECT jsonb_build_object('passed',bool_and(passed),'checks',count(*),
  'results',jsonb_agg(jsonb_build_object('test',test,'passed',passed,'details',details)),
  'scope','Deployed authenticated/anon RLS and checked RPCs; isolated random fixtures; no notification dispatch or concurrent connections.') AS test_report
FROM pg_temp.audience_results;
ROLLBACK;
