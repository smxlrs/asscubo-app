-- LIVE, TRANSACTION-CONTAINED REGISTRATION TEST (040 + 041 required).
-- Run this ENTIRE file in the Supabase SQL Editor as postgres.
-- It creates only randomly identified fixtures with reserved example.invalid
-- email addresses. It never updates/deletes an existing real user or event.
-- All event notification switches are FALSE; no push worker is invoked.
-- This exercises actual RPCs/RLS, but is NOT a multi-connection concurrency test.
-- Do not replace the final ROLLBACK with COMMIT. Any unexpected error aborts the
-- transaction; close the SQL Editor connection or execute ROLLBACK if interrupted.

BEGIN;
SET LOCAL statement_timeout = '180s';
SET LOCAL lock_timeout = '5s';
SET LOCAL idle_in_transaction_session_timeout = '180s';

CREATE TEMP TABLE event_live_results (
  test TEXT PRIMARY KEY,
  passed BOOLEAN NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::JSONB
) ON COMMIT DROP;
DO $temporary_schema_grant$
BEGIN
  EXECUTE format('GRANT USAGE ON SCHEMA %I TO authenticated',
    (SELECT nspname FROM pg_namespace WHERE oid = pg_my_temp_schema()));
END;
$temporary_schema_grant$;
GRANT SELECT, INSERT ON pg_temp.event_live_results TO authenticated;

CREATE FUNCTION pg_temp.live_actor(p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', p_user_id::TEXT, TRUE);
  PERFORM set_config('request.jwt.claims', jsonb_build_object(
    'sub', p_user_id, 'role', 'authenticated', 'aud', 'authenticated')::TEXT, TRUE);
END;
$$;
CREATE FUNCTION pg_temp.live_check(p_name TEXT, p_passed BOOLEAN, p_details JSONB DEFAULT '{}'::JSONB)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  IF p_passed IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'Live registration test failed: %', p_name;
  END IF;
  INSERT INTO pg_temp.event_live_results(test, passed, details) VALUES(p_name, TRUE, p_details);
END;
$$;
REVOKE ALL ON FUNCTION pg_temp.live_actor(UUID), pg_temp.live_check(TEXT, BOOLEAN, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION pg_temp.live_actor(UUID), pg_temp.live_check(TEXT, BOOLEAN, JSONB) TO authenticated;

DO $live_test$
#variable_conflict use_variable
DECLARE
  run_id UUID := gen_random_uuid();
  admin_id UUID := gen_random_uuid();
  people UUID[] := '{}'::UUID[];
  registrations UUID[] := '{}'::UUID[];
  created_events UUID[] := '{}'::UUID[];
  created_user_ids UUID[] := '{}'::UUID[];
  person_id UUID;
  event_id UUID;
  group_event UUID;
  delete_event UUID;
  self_delete_event UUID;
  hidden_event UUID;
  waiting_first UUID;
  waiting_second UUID;
  deleted_self UUID;
  deleted_proxy UUID;
  surviving_waiter UUID;
  self_deleted_registration UUID;
  self_deleted_proxy UUID;
  self_delete_waiter UUID;
  form JSONB := '[{"key":"name","type":"text","label":"姓名","required":true},{"key":"email","type":"email","label":"邮箱","required":true},{"key":"date","type":"date","label":"日期","required":true}]'::JSONB;
  payload JSONB;
  vehicles JSONB;
  answers JSONB;
  attendees JSONB;
  participants JSONB;
  result RECORD;
  event_row public.events%ROWTYPE;
  registration_row public.event_registrations%ROWTYPE;
  old_revision BIGINT;
  original_form_version INTEGER;
  current_form_version INTEGER;
  caught BOOLEAN;
  page JSONB;
  all_pages JSONB := '[]'::JSONB;
  snapshot JSONB;
  cursor_time TIMESTAMPTZ;
  cursor_id UUID;
  num INTEGER;
  deleted_fixture_accounts INTEGER := 0;
BEGIN
  IF current_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'Run the complete rollback test as the SQL Editor postgres role.';
  END IF;
  PERFORM pg_temp.live_check('040 and 041 required objects installed',
    to_regprocedure('public.submit_event_registration_checked(uuid,text,text,integer,jsonb,jsonb,uuid,text,integer)') IS NOT NULL
    AND to_regprocedure('public.submit_event_registration_group_checked(uuid,jsonb,text,integer)') IS NOT NULL
    AND to_regprocedure('public.admin_event_registration_page(uuid,integer,integer,timestamp with time zone,uuid)') IS NOT NULL
    AND to_regclass('public.event_registration_notification_jobs') IS NOT NULL);

  -- Direct SQL does not send confirmation mail. The real auth INSERT triggers
  -- create profiles and enforce domain rules; confirmed fixtures use the normal
  -- admin-provisioned exemption and cannot receive mail at example.invalid.
  FOR num IN 0..207 LOOP
    person_id := CASE WHEN num = 0 THEN admin_id ELSE gen_random_uuid() END;
    IF EXISTS(SELECT 1 FROM auth.users WHERE id = person_id) THEN
      RAISE EXCEPTION 'Random fixture UUID already exists; no existing user was modified.';
    END IF;
    INSERT INTO auth.users(id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change)
    VALUES(person_id, 'authenticated', 'authenticated',
      'event-rollback-' || run_id::TEXT || '-' || num::TEXT || '@example.invalid', '', clock_timestamp(),
      '{"provider":"email","providers":["email"]}'::JSONB,
      jsonb_build_object('name', 'Rollback fixture ' || num::TEXT), clock_timestamp(), clock_timestamp(), '', '', '', '');
    created_user_ids := array_append(created_user_ids, person_id);
    IF num > 0 THEN people := array_append(people, person_id); END IF;
  END LOOP;
  PERFORM pg_temp.live_check('real auth profile trigger created only fixture profiles',
    (SELECT count(*) FROM public.profiles WHERE id = ANY(created_user_ids)) = 208);
  UPDATE public.profiles SET role = 'admin' WHERE id = admin_id;
  INSERT INTO public.admin_permissions(admin_id, permission, granted_by)
  VALUES(admin_id, 'events.manage', admin_id), (admin_id, 'users.delete', admin_id);

  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM pg_temp.live_check('RPC execution really uses the authenticated database role', current_user = 'authenticated');
  PERFORM pg_temp.live_actor(admin_id);
  PERFORM pg_temp.live_check('fixture administrator uses real permission function', public.has_admin_permission('events.manage'));
  payload := jsonb_build_object('title', '[ROLLBACK TEST ' || run_id::TEXT || '] 200 people',
    'description', 'Transaction-only fixture; will be rolled back.',
    'start_time', clock_timestamp() + interval '29 days', 'end_time', clock_timestamp() + interval '30 days',
    'start_has_time', TRUE, 'end_has_time', TRUE, 'has_end_date', TRUE,
    'is_published', TRUE, 'registration_status', 'open', 'registration_start_notify_enabled', FALSE,
    'max_participants', 200, 'allow_waitlist', TRUE, 'allow_proxy_registration', FALSE,
    'vehicle_selection_mode', 'auto', 'registration_form', form);
  vehicles := '[{"name":"Fixture bus 1","capacity":50,"sort_order":0},{"name":"Fixture bus 2","capacity":50,"sort_order":1},{"name":"Fixture bus 3","capacity":50,"sort_order":2},{"name":"Fixture bus 4","capacity":50,"sort_order":3}]'::JSONB;
  event_id := public.admin_save_event_config(NULL, payload, vehicles, NULL);
  created_events := array_append(created_events, event_id);
  SELECT registration_form_version INTO original_form_version FROM public.events WHERE id = event_id;

  FOR num IN 1..202 LOOP
    PERFORM pg_temp.live_actor(people[num]);
    answers := jsonb_build_object('name', 'Fixture person ' || num::TEXT,
      'email', 'person-' || num::TEXT || '@example.invalid', 'date', '2026-10-01');
    attendees := jsonb_build_array(jsonb_build_object('name', 'Fixture person ' || num::TEXT,
      'email', 'person-' || num::TEXT || '@example.invalid', 'phone', '+39051234567'));
    SELECT * INTO result FROM public.submit_event_registration_checked(event_id, 'self', NULL, 1,
      answers, attendees, NULL, 'app', original_form_version);
    IF result.registration_status IS DISTINCT FROM (CASE WHEN num <= 200 THEN 'confirmed' ELSE 'waitlist' END) THEN
      RAISE EXCEPTION 'Unexpected registration outcome at fixture index %.', num;
    END IF;
    registrations := array_append(registrations, result.registration_id);
  END LOOP;
  PERFORM pg_temp.live_actor(admin_id);
  PERFORM pg_temp.live_check('200 distinct users confirmed and two waitlisted',
    (SELECT count(DISTINCT r.user_id) = 202
      AND count(*) FILTER(WHERE r.status = 'confirmed') = 200
      AND count(*) FILTER(WHERE r.status = 'waitlist') = 2
      FROM public.event_registrations r WHERE r.id = ANY(registrations)),
    jsonb_build_object('submitted', 202, 'confirmed', 200, 'waitlisted', 2));
  -- Qualify both column names: all subsequent checks are limited to fixture IDs.
  PERFORM pg_temp.live_check('four vehicles have exactly 50 confirmed passengers each',
    (SELECT count(*) = 4 AND min(occupied) = 50 AND max(occupied) = 50 FROM (
      SELECT r.vehicle_id, sum(r.participant_count) AS occupied FROM public.event_registrations r
      WHERE r.id = ANY(registrations) AND r.status = 'confirmed' GROUP BY r.vehicle_id) seats));
  PERFORM pg_temp.live_check('202 complete independent attendee records',
    (SELECT count(*) FROM public.event_registration_attendees a WHERE a.registration_id = ANY(registrations)) = 202);
  SELECT r.id INTO waiting_first FROM public.event_registrations r
  WHERE r.id IN (registrations[201], registrations[202]) ORDER BY r.registered_at, r.id LIMIT 1;
  waiting_second := CASE WHEN waiting_first = registrations[201] THEN registrations[202] ELSE registrations[201] END;
  -- now() is shared by this outer transaction, so tied fixture registration
  -- times use the documented UUID tie-breaker instead of pretending to be 202 transactions.

  PERFORM pg_temp.live_actor(people[1]);
  PERFORM pg_temp.live_check('RLS own registration visible',
    (SELECT count(*) FROM public.event_registrations r WHERE r.id = registrations[1]) = 1);
  PERFORM pg_temp.live_check('RLS another user registration and answers hidden',
    (SELECT count(*) FROM public.event_registrations r WHERE r.id = registrations[2]) = 0
    AND (SELECT count(*) FROM public.event_registration_attendees a WHERE a.registration_id = registrations[2]) = 0);
  caught := FALSE;
  BEGIN
    PERFORM public.cancel_event_registration(registrations[2]);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%Registration not found%' THEN RAISE; END IF;
    caught := TRUE;
  END;
  PERFORM pg_temp.live_check('another user cancellation rejected', caught);
  caught := FALSE;
  BEGIN
    PERFORM * FROM public.submit_event_registration_checked(event_id, 'self', NULL, 1,
      '{"name":"Duplicate","email":"duplicate@example.invalid","date":"2026-10-01"}',
      '[{"name":"Duplicate"}]', NULL, 'app', original_form_version);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%already have an active registration%' THEN RAISE; END IF;
    caught := TRUE;
  END;
  PERFORM pg_temp.live_check('duplicate self registration rejected', caught);
  caught := FALSE;
  BEGIN
    PERFORM * FROM public.submit_event_registration_checked(event_id, 'self', NULL, 2,
      '{"name":"Bypass","email":"bypass@example.invalid","date":"2026-10-01"}',
      '[{"name":"One"},{"name":"Two"}]', NULL, 'app', original_form_version);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%exactly one participant%' THEN RAISE; END IF;
    caught := TRUE;
  END;
  PERFORM pg_temp.live_check('disabled group mode cannot be bypassed with self count two', caught);
  PERFORM public.cancel_event_registration(registrations[1]);
  PERFORM pg_temp.live_actor(admin_id);
  PERFORM pg_temp.live_check('cancellation frees one seat and promotes first eligible waiter',
    (SELECT r.status FROM public.event_registrations r WHERE r.id = registrations[1]) = 'cancelled'
    AND (SELECT r.vehicle_id IS NOT NULL FROM public.event_registrations r WHERE r.id = registrations[1])
    AND (SELECT r.status FROM public.event_registrations r WHERE r.id = waiting_first) = 'confirmed');

  SELECT * INTO event_row FROM public.events e WHERE e.id = event_id;
  SELECT jsonb_agg(to_jsonb(v) ORDER BY v.sort_order, v.id) INTO vehicles FROM public.event_vehicles v WHERE v.event_id = event_row.id;
  PERFORM public.admin_save_event_config(event_row.id, to_jsonb(event_row) || '{"registration_status":"closed"}', vehicles, event_row.revision);
  PERFORM pg_temp.live_actor(people[2]);
  PERFORM public.cancel_event_registration(registrations[2]);
  PERFORM pg_temp.live_actor(admin_id);
  PERFORM pg_temp.live_check('closing registration stops automatic promotion',
    (SELECT r.status FROM public.event_registrations r WHERE r.id = waiting_second) = 'waitlist');
  SELECT * INTO event_row FROM public.events e WHERE e.id = event_id;
  PERFORM public.admin_save_event_config(event_row.id, to_jsonb(event_row) || '{"registration_status":"open"}', vehicles, event_row.revision);
  PERFORM pg_temp.live_check('reopening promotes existing waiter before newcomers',
    (SELECT r.status FROM public.event_registrations r WHERE r.id = waiting_second) = 'confirmed');

  PERFORM pg_temp.live_actor(people[3]);
  SELECT * INTO registration_row FROM public.event_registrations r WHERE r.id = registrations[3];
  old_revision := registration_row.revision;
  PERFORM * FROM public.update_event_registration(registration_row.id, NULL, 1,
    registration_row.answers || '{"name":"Updated fixture name"}', '[{"name":"Updated fixture name"}]',
    registration_row.vehicle_id, old_revision);
  caught := FALSE;
  BEGIN
    PERFORM * FROM public.update_event_registration(registration_row.id, NULL, 1,
      registration_row.answers, '[{"name":"Stale name"}]', registration_row.vehicle_id, old_revision);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%Registration changed; reload%' THEN RAISE; END IF;
    caught := TRUE;
  END;
  PERFORM pg_temp.live_check('stale registration revision rejected without overwriting answer', caught
    AND (SELECT r.answers ->> 'name' FROM public.event_registrations r WHERE r.id = registration_row.id) = 'Updated fixture name');
  PERFORM pg_temp.live_actor(admin_id);
  SELECT * INTO event_row FROM public.events e WHERE e.id = event_id;
  old_revision := event_row.revision;
  PERFORM public.admin_save_event_config(event_row.id, to_jsonb(event_row) || '{"location":"Updated fixture location"}', vehicles, old_revision);
  caught := FALSE;
  BEGIN
    PERFORM public.admin_save_event_config(event_row.id, to_jsonb(event_row) || '{"location":"Stale location"}', vehicles, old_revision);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%Event changed; reload%' THEN RAISE; END IF;
    caught := TRUE;
  END;
  PERFORM pg_temp.live_check('stale event revision rejected', caught);
  PERFORM pg_temp.live_actor(people[203]);
  caught := FALSE;
  BEGIN
    PERFORM * FROM public.submit_event_registration_checked(event_id, 'self', NULL, 1,
      '{"name":"Stale form","email":"stale@example.invalid","date":"2026-10-01"}',
      '[{"name":"Stale form"}]', NULL, 'app', original_form_version);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%Event form changed; reload%' THEN RAISE; END IF;
    caught := TRUE;
  END;
  PERFORM pg_temp.live_check('stale new-registration form version rejected with zero writes', caught
    AND (SELECT count(*) FROM public.event_registrations r WHERE r.user_id = people[203] AND r.event_id = event_id) = 0);

  PERFORM pg_temp.live_actor(admin_id);
  group_event := public.admin_save_event_config(NULL, payload || jsonb_build_object('title','[ROLLBACK TEST ' || run_id::TEXT || '] group atomicity',
    'max_participants',1,'allow_waitlist',FALSE,'allow_proxy_registration',TRUE,'vehicle_selection_mode','none'), '[]', NULL);
  created_events := array_append(created_events, group_event);
  SELECT e.registration_form_version INTO current_form_version FROM public.events e WHERE e.id = group_event;
  participants := '[{"name":"Fixture self","answers":{"name":"Fixture self","email":"self@example.invalid","date":"2026-10-01"}},{"name":"Fixture guest","proxy_note":"Test friend","answers":{"name":"Fixture guest","email":"guest@example.invalid","date":"2026-10-01"}}]'::JSONB;
  PERFORM pg_temp.live_actor(people[203]);
  caught := FALSE;
  BEGIN
    PERFORM * FROM public.submit_event_registration_group_checked(group_event, participants, 'app', current_form_version);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%This event is full%' THEN RAISE; END IF;
    caught := TRUE;
  END;
  PERFORM pg_temp.live_actor(admin_id);
  PERFORM pg_temp.live_check('group second-person failure rolls back first person and answers', caught
    AND (SELECT count(*) FROM public.event_registrations r WHERE r.event_id = group_event) = 0);

  hidden_event := public.admin_save_event_config(NULL, payload || jsonb_build_object('title','[ROLLBACK TEST ' || run_id::TEXT || '] availability',
    'vehicle_selection_mode','none','max_participants',NULL), '[]', NULL);
  created_events := array_append(created_events, hidden_event);
  SELECT e.registration_form_version INTO current_form_version FROM public.events e WHERE e.id = hidden_event;
  PERFORM pg_temp.live_actor(people[203]);
  SELECT * INTO result FROM public.submit_event_registration_checked(hidden_event, 'self', NULL, 1,
    '{"name":"Availability","email":"availability@example.invalid","date":"2026-10-01"}',
    '[{"name":"Availability"}]', NULL, 'app', current_form_version);
  SELECT * INTO registration_row FROM public.event_registrations r WHERE r.id = result.registration_id;
  FOR num IN 1..3 LOOP
    PERFORM pg_temp.live_actor(admin_id);
    SELECT * INTO event_row FROM public.events e WHERE e.id = hidden_event;
    PERFORM public.admin_save_event_config(hidden_event, to_jsonb(event_row) || CASE num
      WHEN 1 THEN '{"is_published":false}'::JSONB
      WHEN 2 THEN '{"is_published":true,"registration_status":"closed"}'::JSONB
      ELSE jsonb_build_object('registration_status','open','registration_start_at',clock_timestamp()+interval '1 hour') END, '[]', event_row.revision);
    PERFORM pg_temp.live_actor(people[203]);
    caught := FALSE;
    BEGIN
      PERFORM * FROM public.update_event_registration(registration_row.id, NULL, 1, registration_row.answers,
        '[{"name":"Availability"}]', NULL, registration_row.revision);
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE '%not open%' AND SQLERRM NOT LIKE '%not opened yet%' THEN RAISE; END IF;
      caught := TRUE;
    END;
    PERFORM pg_temp.live_check(CASE num WHEN 1 THEN 'unpublished event rejects existing-registration edits'
      WHEN 2 THEN 'closed event rejects existing-registration edits' ELSE 'future opening rejects existing-registration edits' END, caught);
  END LOOP;

  PERFORM pg_temp.live_actor(admin_id);
  delete_event := public.admin_save_event_config(NULL, payload || jsonb_build_object('title','[ROLLBACK TEST ' || run_id::TEXT || '] admin account removal',
    'vehicle_selection_mode','none','max_participants',2,'allow_proxy_registration',TRUE), '[]', NULL);
  created_events := array_append(created_events, delete_event);
  SELECT e.registration_form_version INTO current_form_version FROM public.events e WHERE e.id = delete_event;
  PERFORM pg_temp.live_actor(people[204]);
  SELECT r.registration_id INTO deleted_self FROM public.submit_event_registration_checked(delete_event,'self',NULL,1,
    '{"name":"Deleting self","email":"delete-self@example.invalid","date":"2026-10-01"}','[{"name":"Deleting self"}]',NULL,'app',current_form_version) r;
  SELECT r.registration_id INTO deleted_proxy FROM public.submit_event_registration_checked(delete_event,'proxy','Fixture guest',1,
    '{"name":"Deleting guest","email":"delete-guest@example.invalid","date":"2026-10-01"}','[{"name":"Deleting guest"}]',NULL,'app',current_form_version) r;
  PERFORM pg_temp.live_actor(people[205]);
  SELECT r.registration_id INTO surviving_waiter FROM public.submit_event_registration_checked(delete_event,'self',NULL,1,
    '{"name":"Surviving waiter","email":"surviving@example.invalid","date":"2026-10-01"}','[{"name":"Surviving waiter"}]',NULL,'app',current_form_version) r;
  PERFORM pg_temp.live_actor(admin_id);
  PERFORM public.admin_delete_user(people[204]);
  deleted_fixture_accounts := deleted_fixture_accounts + 1;
  PERFORM pg_temp.live_check('admin account deletion removes fixture self and proxy and promotes waiter',
    (SELECT count(*) FROM public.event_registrations r WHERE r.id IN(deleted_self,deleted_proxy)) = 0
    AND (SELECT count(*) FROM public.event_registration_attendees a WHERE a.registration_id IN(deleted_self,deleted_proxy)) = 0
    AND (SELECT r.status FROM public.event_registrations r WHERE r.id = surviving_waiter) = 'confirmed');

  self_delete_event := public.admin_save_event_config(NULL, payload || jsonb_build_object('title','[ROLLBACK TEST ' || run_id::TEXT || '] self account removal',
    'vehicle_selection_mode','auto','max_participants',2,'allow_proxy_registration',TRUE),
    '[{"name":"Self deletion test bus","capacity":2,"reserved_seats":0,"sort_order":0}]', NULL);
  created_events := array_append(created_events, self_delete_event);
  SELECT e.registration_form_version INTO current_form_version FROM public.events e WHERE e.id = self_delete_event;
  PERFORM pg_temp.live_actor(people[206]);
  SELECT r.registration_id INTO self_deleted_registration FROM public.submit_event_registration_checked(self_delete_event,'self',NULL,1,
    '{"name":"Self deleting","email":"self-delete@example.invalid","date":"2026-10-01"}','[{"name":"Self deleting"}]',NULL,'app',current_form_version) r;
  SELECT r.registration_id INTO self_deleted_proxy FROM public.submit_event_registration_checked(self_delete_event,'proxy','Self deletion guest',1,
    '{"name":"Self deletion guest","email":"self-guest@example.invalid","date":"2026-10-01"}','[{"name":"Self deletion guest"}]',NULL,'app',current_form_version) r;
  PERFORM pg_temp.live_actor(people[207]);
  SELECT r.registration_id INTO self_delete_waiter FROM public.submit_event_registration_checked(self_delete_event,'self',NULL,1,
    '{"name":"Self delete waiter","email":"self-wait@example.invalid","date":"2026-10-01"}','[{"name":"Self delete waiter"}]',NULL,'app',current_form_version) r;
  PERFORM pg_temp.live_actor(people[206]);
  IF to_regprocedure('public.delete_user_account()') IS NULL THEN
    INSERT INTO pg_temp.event_live_results(test,passed,details)
    VALUES('self account deletion releases the place and promotes waiter',FALSE,
      jsonb_build_object('reason','missing self-delete RPC','missing_function','public.delete_user_account()',
        'execution','Skipped this unavailable operation; no function was created or deployment changed.'));
  ELSE
    PERFORM pg_temp.live_check('self deletion only grants execution to authenticated users',
      has_function_privilege('authenticated','public.delete_user_account()','EXECUTE')
      AND NOT has_function_privilege('anon','public.delete_user_account()','EXECUTE'));
    PERFORM pg_temp.live_actor(NULL);
    caught := FALSE;
    BEGIN
      PERFORM public.delete_user_account();
    EXCEPTION WHEN insufficient_privilege THEN
      caught := TRUE;
    END;
    PERFORM pg_temp.live_check('self deletion without caller identity is rejected', caught);
    PERFORM pg_temp.live_actor(people[206]);
    PERFORM public.delete_user_account();
    deleted_fixture_accounts := deleted_fixture_accounts + 1;
    PERFORM pg_temp.live_actor(admin_id);
    PERFORM pg_temp.live_check('self account deletion releases the place and promotes waiter',
      (SELECT count(*) FROM public.event_registrations r WHERE r.id IN (self_deleted_registration,self_deleted_proxy)) = 0
      AND NOT EXISTS(SELECT 1 FROM public.event_registration_attendees a WHERE a.registration_id IN (self_deleted_registration,self_deleted_proxy))
      AND NOT EXISTS(SELECT 1 FROM public.profiles WHERE id = people[206])
      AND (SELECT r.status = 'confirmed' AND r.vehicle_id IS NOT NULL FROM public.event_registrations r WHERE r.id = self_delete_waiter)
      AND (SELECT count(*) FROM public.event_registrations r WHERE r.event_id = self_delete_event AND r.status = 'confirmed') = 1);
    PERFORM pg_temp.live_actor(people[206]);
    caught := FALSE;
    BEGIN
      PERFORM public.delete_user_account();
    EXCEPTION WHEN insufficient_privilege THEN
      caught := TRUE;
    END;
    PERFORM pg_temp.live_check('deleted-account token cannot remove another account', caught);
  END IF;
  PERFORM pg_temp.live_actor(admin_id);

  LOOP
    page := public.admin_event_registration_page(event_id,0,100,cursor_time,cursor_id);
    all_pages := all_pages || page;
    EXIT WHEN jsonb_array_length(page) < 100;
    cursor_time := (page -> (jsonb_array_length(page)-1) ->> 'registered_at')::TIMESTAMPTZ;
    cursor_id := (page -> (jsonb_array_length(page)-1) ->> 'id')::UUID;
  END LOOP;
  PERFORM pg_temp.live_check('admin cursor pagination returns all 202 registrations once',
    jsonb_array_length(all_pages) = 202 AND (SELECT count(DISTINCT p ->> 'id') FROM jsonb_array_elements(all_pages) p) = 202);
  snapshot := public.admin_event_registration_snapshot(event_id);
  PERFORM pg_temp.live_check('export snapshot retains all answers attendees forms account attribution and four buses',
    jsonb_array_length(snapshot -> 'registrations') = 202 AND jsonb_array_length(snapshot -> 'vehicles') = 4
    AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(snapshot -> 'registrations') r
      WHERE jsonb_array_length(r -> 'attendees') <> 1 OR jsonb_array_length(r -> 'form_snapshot') <> 3
        OR NULLIF(r ->> 'registered_by_email','') IS NULL OR NULLIF(r -> 'answers' ->> 'name','') IS NULL));
  FOR num IN 1..202 LOOP
    SELECT item INTO page FROM jsonb_array_elements(snapshot -> 'registrations') item
    WHERE item ->> 'id' = registrations[num]::TEXT;
    IF page IS NULL
       OR page -> 'answers' ->> 'name' IS DISTINCT FROM (CASE WHEN num = 3 THEN 'Updated fixture name' ELSE 'Fixture person ' || num::TEXT END)
       OR page -> 'answers' ->> 'email' IS DISTINCT FROM 'person-' || num::TEXT || '@example.invalid'
       OR page -> 'answers' ->> 'date' IS DISTINCT FROM '2026-10-01'
       OR page -> 'attendees' -> 0 -> 'answers' IS DISTINCT FROM page -> 'answers'
       OR page ->> 'user_id' IS DISTINCT FROM people[num]::TEXT
       OR page -> 'form_snapshot' IS DISTINCT FROM form
       OR page ->> 'registered_by_email' IS DISTINCT FROM 'event-rollback-' || run_id::TEXT || '-' || num::TEXT || '@example.invalid'
       OR page ->> 'registered_by_name' IS DISTINCT FROM 'Rollback fixture ' || num::TEXT THEN
      RAISE EXCEPTION 'Export data mismatch at fixture index %.', num;
    END IF;
  END LOOP;
  PERFORM pg_temp.live_check('every exported answer attendee answer and account identity matches all 202 fixture inputs', TRUE);
  PERFORM pg_temp.live_check('no fixture notification job was created',
    NOT EXISTS(SELECT 1 FROM public.event_registration_notification_jobs j WHERE j.event_id = ANY(created_events)));

  PERFORM pg_temp.live_actor(people[3]);
  caught := FALSE;
  BEGIN
    PERFORM public.admin_event_registration_snapshot(event_id);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%permission is required%' THEN RAISE; END IF;
    caught := TRUE;
  END;
  PERFORM pg_temp.live_check('student cannot export administrator snapshot', caught);
  caught := FALSE;
  BEGIN
    PERFORM * FROM public.submit_event_registration(event_id,'self',NULL,1,'{}','[]',NULL,'app');
  EXCEPTION WHEN insufficient_privilege THEN caught := TRUE;
  END;
  PERFORM pg_temp.live_check('unchecked legacy submission is not executable by authenticated client', caught);
  PERFORM pg_temp.live_check('client cannot call private helpers or write registration/config tables directly',
    NOT has_function_privilege('authenticated','public.promote_event_waitlist(uuid)','EXECUTE')
    AND NOT has_function_privilege('authenticated','public.submit_event_registration_group(uuid,jsonb,text)','EXECUTE')
    AND NOT has_function_privilege('authenticated','public.admin_assign_event_registration(uuid,uuid)','EXECUTE')
    AND NOT has_table_privilege('authenticated','public.event_registrations','UPDATE')
    AND NOT has_table_privilege('authenticated','public.events','UPDATE'));
  PERFORM pg_temp.live_check('anonymous role cannot execute checked single or group submission',
    NOT has_function_privilege('anon','public.submit_event_registration_checked(uuid,text,text,integer,jsonb,jsonb,uuid,text,integer)','EXECUTE')
    AND NOT has_function_privilege('anon','public.submit_event_registration_group_checked(uuid,jsonb,text,integer)','EXECUTE'));
  EXECUTE 'RESET ROLE';
  PERFORM pg_temp.live_check('fixture auth deletions match only their successfully requested test accounts',
    (SELECT count(*) FROM auth.users u WHERE u.id = ANY(created_user_ids)) = 208 - deleted_fixture_accounts,
    jsonb_build_object('successfully_deleted_fixture_accounts',deleted_fixture_accounts));
  PERFORM pg_temp.live_check('fixture IDs for exact post-rollback cleanup verification', TRUE,
    jsonb_build_object('run_id',run_id,'event_ids',to_jsonb(created_events),
      'user_ids',to_jsonb(created_user_ids),'bulk_registration_ids',to_jsonb(registrations)));
  RAISE NOTICE 'Rollback test run % completed. See the report for individual pass/fail results. Every write remains uncommitted and the final statement rolls back.', run_id;
END;
$live_test$;

SELECT jsonb_build_object(
  'test', 'event_registration_live_transaction_rollback',
  'passed', bool_and(passed),
  'checks', count(*),
  'results', jsonb_agg(jsonb_build_object('test', test, 'passed', passed, 'details', details) ORDER BY test),
  'scope', 'Actual deployed RPCs and RLS; sequential calls inside one transaction; no multi-connection concurrency or Expo requests.',
  'cleanup', 'The final ROLLBACK discards every fixture identity, activity, registration, audit entry and temporary test object.'
) AS test_report
FROM pg_temp.event_live_results;

ROLLBACK;
