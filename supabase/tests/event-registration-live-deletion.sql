-- Random fixtures only; no dispatch, Expo request, or real account changes.
BEGIN;
SET LOCAL statement_timeout = '90s';
SET LOCAL lock_timeout = '5s';
CREATE TEMP TABLE deletion_results(test TEXT, passed BOOLEAN, details JSONB DEFAULT '{}'::JSONB);
DO $test$
DECLARE run_id UUID := gen_random_uuid(); manager UUID := gen_random_uuid(); student UUID := gen_random_uuid();
  target UUID; registration UUID; revision_before BIGINT; revision_deleted BIGINT; form_version INTEGER;
  person UUID; denied BOOLEAN; payload JSONB;
BEGIN
  FOREACH person IN ARRAY ARRAY[manager,student] LOOP
    INSERT INTO auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,
      created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change)
    VALUES(person,'authenticated','authenticated','delete-rollback-'||person||'@example.invalid','',clock_timestamp(),
      '{"provider":"email","providers":["email"]}',jsonb_build_object('name','Deletion fixture'),clock_timestamp(),clock_timestamp(),'','','','');
  END LOOP;
  UPDATE public.profiles SET role='admin' WHERE id=manager;
  INSERT INTO public.admin_permissions(admin_id,permission,granted_by) VALUES(manager,'events.manage',manager);
  PERFORM set_config('request.jwt.claim.sub',manager::TEXT,TRUE);
  EXECUTE 'SET LOCAL ROLE authenticated';
  payload := jsonb_build_object('title','[ROLLBACK DELETE '||run_id||']','description','Temporary fixture',
    'start_time',clock_timestamp()+interval '29 days','end_time',clock_timestamp()+interval '30 days',
    'is_published',TRUE,'registration_status','open','registration_form','[]'::JSONB,
    'vehicle_selection_mode','auto','registration_start_notify_enabled',FALSE);
  target := public.admin_save_event_config(NULL,payload,'[{"name":"Fixture bus","capacity":2,"reserved_seats":0}]',NULL);
  SELECT revision,registration_form_version INTO revision_before,form_version FROM public.events WHERE id=target;
  PERFORM set_config('request.jwt.claim.sub',student::TEXT,TRUE);
  PERFORM * FROM public.submit_event_registration_checked(target,'self',NULL,1,'{}','[{"name":"Fixture participant"}]',NULL,'app',form_version);
  SELECT id INTO registration FROM public.event_registrations WHERE event_id=target;
  IF registration IS NULL THEN RAISE EXCEPTION 'Fixture registration missing'; END IF;
  PERFORM set_config('request.jwt.claim.sub',manager::TEXT,TRUE);
  denied := FALSE;
  BEGIN PERFORM public.admin_permanently_delete_event(target,revision_before);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%Move the event%' THEN RAISE; END IF; denied:=TRUE;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Active event could be permanently deleted'; END IF;
  EXECUTE 'RESET ROLE';
  INSERT INTO deletion_results VALUES('active event requires explicit soft deletion first',TRUE);
  -- Schedule only inside this uncommitted transaction. Nothing can be dispatched.
  UPDATE public.events SET registration_start_at=clock_timestamp()+interval '1 day',registration_start_notify_enabled=TRUE WHERE id=target;
  SELECT revision INTO revision_before FROM public.events WHERE id=target;
  IF NOT EXISTS(SELECT 1 FROM public.event_registration_notification_jobs WHERE event_id=target) THEN RAISE EXCEPTION 'Missing fixture reminder'; END IF;
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM public.admin_delete_event(target,revision_before);
  SELECT revision INTO revision_deleted FROM public.events WHERE id=target;
  denied:=FALSE;
  BEGIN PERFORM public.admin_permanently_delete_event(target,revision_before);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%reload before deleting%' THEN RAISE; END IF; denied:=TRUE;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Stale revision accepted'; END IF;
  PERFORM set_config('request.jwt.claim.sub',student::TEXT,TRUE);
  denied:=FALSE;
  BEGIN PERFORM public.admin_permanently_delete_event(target,revision_deleted);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%permission is required%' THEN RAISE; END IF; denied:=TRUE;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Student could permanently delete'; END IF;
  PERFORM set_config('request.jwt.claim.sub',manager::TEXT,TRUE);
  PERFORM public.admin_permanently_delete_event(target,revision_deleted);
  EXECUTE 'RESET ROLE';
  INSERT INTO deletion_results VALUES('stale revision and student rejected; manager can delete',TRUE);
  IF EXISTS(SELECT 1 FROM public.events WHERE id=target)
    OR EXISTS(SELECT 1 FROM public.event_registrations WHERE event_id=target)
    OR EXISTS(SELECT 1 FROM public.event_registration_attendees WHERE registration_id=registration)
    OR EXISTS(SELECT 1 FROM public.event_vehicles WHERE event_id=target)
    OR EXISTS(SELECT 1 FROM public.event_registration_audit_logs WHERE event_id=target)
    OR EXISTS(SELECT 1 FROM public.event_registration_notification_jobs WHERE event_id=target)
    OR EXISTS(SELECT 1 FROM cron.job WHERE jobname='event-registration-start-'||replace(target::TEXT,'-',''))
    THEN RAISE EXCEPTION 'Related fixture data or cron remains'; END IF;
  INSERT INTO deletion_results VALUES('real FK cascades and reminder cleanup leave no fixture activity data',TRUE);
  IF has_function_privilege('anon','public.admin_permanently_delete_event(uuid,bigint)','EXECUTE') THEN RAISE EXCEPTION 'Anonymous EXECUTE granted'; END IF;
  INSERT INTO deletion_results VALUES('anonymous cannot execute permanent deletion',TRUE);
  INSERT INTO deletion_results VALUES('fixture IDs for exact cleanup verification',TRUE,
    jsonb_build_object('run_id',run_id,'event_ids',ARRAY[target],'user_ids',ARRAY[manager,student]));
END;
$test$;
SELECT jsonb_build_object('passed',bool_and(passed),'checks',count(*),'results',
  jsonb_agg(jsonb_build_object('test',test,'passed',passed,'details',details)),
  'scope','Transaction-only live deletion RPC, FK cascades, permission and revision checks; no sends.') AS test_report FROM deletion_results;
ROLLBACK;
