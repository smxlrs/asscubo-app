-- LIVE TRANSACTION-CONTAINED VEHICLE TEST (040 + 041 required).
-- Run this ENTIRE file as the Supabase SQL Editor postgres role.
-- Ten random confirmed fixture users and two new fixture events are created.
-- Email addresses use example.invalid; direct SQL sends no confirmation email.
-- Notifications are disabled on both events and no push function is called.
-- Calls exercise deployed RPCs with the authenticated role. The stale-seat
-- scenario is sequential: it does NOT claim to test concurrent connections.
-- Every assertion is restricted to random fixture IDs. Keep the final ROLLBACK.

BEGIN;
SET LOCAL statement_timeout = '120s';
SET LOCAL lock_timeout = '5s';
SET LOCAL idle_in_transaction_session_timeout = '120s';

CREATE TEMP TABLE event_vehicle_live_results (
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
GRANT SELECT, INSERT ON pg_temp.event_vehicle_live_results TO authenticated;

CREATE FUNCTION pg_temp.vehicle_actor(p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', p_user_id::TEXT, TRUE);
  PERFORM set_config('request.jwt.claims', jsonb_build_object(
    'sub', p_user_id, 'role', 'authenticated', 'aud', 'authenticated')::TEXT, TRUE);
END;
$$;
CREATE FUNCTION pg_temp.vehicle_check(p_name TEXT, p_passed BOOLEAN, p_details JSONB DEFAULT '{}'::JSONB)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  IF p_passed IS DISTINCT FROM TRUE THEN RAISE EXCEPTION 'Live vehicle test failed: %', p_name; END IF;
  INSERT INTO pg_temp.event_vehicle_live_results(test, passed, details) VALUES(p_name, TRUE, p_details);
END;
$$;
REVOKE ALL ON FUNCTION pg_temp.vehicle_actor(UUID), pg_temp.vehicle_check(TEXT, BOOLEAN, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION pg_temp.vehicle_actor(UUID), pg_temp.vehicle_check(TEXT, BOOLEAN, JSONB) TO authenticated;

DO $vehicle_test$
#variable_conflict use_variable
DECLARE
  run_id UUID := gen_random_uuid();
  admin_id UUID := gen_random_uuid();
  people UUID[] := '{}'::UUID[];
  user_ids UUID[] := '{}'::UUID[];
  person_id UUID;
  selected_event UUID;
  manual_event UUID;
  bus_a UUID;
  bus_b UUID;
  manual_bus UUID;
  registrations UUID[] := '{}'::UUID[];
  manual_confirmed UUID;
  manual_waiter UUID;
  manual_newcomer UUID;
  form_version INTEGER;
  payload JSONB;
  result RECORD;
  registration_row public.event_registrations%ROWTYPE;
  event_row public.events%ROWTYPE;
  original_registration JSONB;
  original_attendees JSONB;
  original_audit_count BIGINT;
  before_failed_submit_count BIGINT;
  snapshot JSONB;
  snapshot_registration JSONB;
  caught BOOLEAN;
  seats_seen INTEGER;
  num INTEGER;
BEGIN
  IF current_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'Run the complete rollback test as the SQL Editor postgres role.';
  END IF;
  PERFORM pg_temp.vehicle_check('reviewed checked registration and administrator RPCs installed',
    to_regprocedure('public.submit_event_registration_checked(uuid,text,text,integer,jsonb,jsonb,uuid,text,integer)') IS NOT NULL
    AND to_regprocedure('public.update_event_registration(uuid,text,integer,jsonb,jsonb,uuid,bigint)') IS NOT NULL
    AND to_regprocedure('public.admin_update_event_registration_full(uuid,text,text,text,jsonb,text,uuid,boolean,bigint)') IS NOT NULL
    AND to_regclass('public.event_registration_notification_jobs') IS NOT NULL);

  FOR num IN 0..9 LOOP
    person_id := CASE WHEN num = 0 THEN admin_id ELSE gen_random_uuid() END;
    IF EXISTS(SELECT 1 FROM auth.users u WHERE u.id = person_id) THEN
      RAISE EXCEPTION 'Random fixture UUID already exists; existing user left untouched.';
    END IF;
    INSERT INTO auth.users(id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change)
    VALUES(person_id, 'authenticated', 'authenticated',
      'vehicle-rollback-' || run_id::TEXT || '-' || num::TEXT || '@example.invalid', '', clock_timestamp(),
      '{"provider":"email","providers":["email"]}'::JSONB,
      jsonb_build_object('name', 'Vehicle fixture ' || num::TEXT), clock_timestamp(), clock_timestamp(), '', '', '', '');
    user_ids := array_append(user_ids, person_id);
    IF num > 0 THEN people := array_append(people, person_id); END IF;
  END LOOP;
  PERFORM pg_temp.vehicle_check('ten fixture users have real trigger-created profiles',
    (SELECT count(*) FROM public.profiles p WHERE p.id = ANY(user_ids)) = 10);
  UPDATE public.profiles SET role = 'admin' WHERE id = admin_id;
  INSERT INTO public.admin_permissions(admin_id, permission, granted_by) VALUES(admin_id, 'events.manage', admin_id);

  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM pg_temp.vehicle_actor(admin_id);
  PERFORM pg_temp.vehicle_check('actual authenticated role and scoped event-management permission',
    current_user = 'authenticated' AND public.has_admin_permission('events.manage'));
  payload := jsonb_build_object(
    'title', '[ROLLBACK VEHICLE TEST ' || run_id::TEXT || '] self-selected vehicles',
    'description', 'Transaction-only vehicle fixture; all changes will be rolled back.',
    'start_time', clock_timestamp() + interval '29 days', 'end_time', clock_timestamp() + interval '30 days',
    'has_end_date', TRUE, 'start_has_time', TRUE, 'end_has_time', TRUE,
    'is_published', TRUE, 'registration_status', 'open', 'registration_start_notify_enabled', FALSE,
    'max_participants', 4, 'allow_waitlist', TRUE, 'allow_proxy_registration', FALSE,
    'vehicle_selection_mode', 'self_select',
    'registration_form', '[{"key":"name","label":"姓名","type":"text","required":true},{"key":"phone","label":"电话","type":"phone","required":false}]'::JSONB);
  selected_event := public.admin_save_event_config(NULL, payload,
    '[{"name":"Fixture A","capacity":3,"reserved_seats":1,"sort_order":0},{"name":"Fixture B","capacity":2,"reserved_seats":0,"sort_order":1}]', NULL);
  SELECT v.id INTO bus_a FROM public.event_vehicles v WHERE v.event_id = selected_event AND v.sort_order = 0;
  SELECT v.id INTO bus_b FROM public.event_vehicles v WHERE v.event_id = selected_event AND v.sort_order = 1;
  SELECT e.registration_form_version INTO form_version FROM public.events e WHERE e.id = selected_event;
  PERFORM pg_temp.vehicle_check('two separate buses expose four usable seats with one reserved',
    bus_a IS NOT NULL AND bus_b IS NOT NULL AND bus_a <> bus_b
    AND (SELECT sum(v.capacity - v.reserved_seats) FROM public.event_vehicles v WHERE v.event_id = selected_event) = 4);

  PERFORM pg_temp.vehicle_actor(people[1]);
  SELECT * INTO result FROM public.submit_event_registration_checked(selected_event, 'self', NULL, 1,
    '{"name":"A first"}', '[{"name":"A first"}]', bus_a, 'app', form_version);
  registrations := array_append(registrations, result.registration_id);
  PERFORM pg_temp.vehicle_check('first self-selected passenger receives bus A',
    result.registration_status = 'confirmed' AND result.assigned_vehicle_id = bus_a);

  -- Simulate reading the final usable A seat, then another user taking it before
  -- submission. This is deliberately ordered, not concurrent network traffic.
  PERFORM pg_temp.vehicle_actor(admin_id);
  SELECT v.capacity - v.reserved_seats - COALESCE((SELECT sum(r.participant_count)
    FROM public.event_registrations r WHERE r.event_id = selected_event AND r.vehicle_id = bus_a AND r.status = 'confirmed'), 0)
  INTO seats_seen FROM public.event_vehicles v WHERE v.id = bus_a;
  PERFORM pg_temp.vehicle_check('stale-seat scenario initially observes one available seat', seats_seen = 1);
  PERFORM pg_temp.vehicle_actor(people[2]);
  SELECT * INTO result FROM public.submit_event_registration_checked(selected_event, 'self', NULL, 1,
    '{"name":"A second"}', '[{"name":"A second"}]', bus_a, 'app', form_version);
  registrations := array_append(registrations, result.registration_id);
  PERFORM pg_temp.vehicle_actor(people[3]);
  SELECT * INTO result FROM public.submit_event_registration_checked(selected_event, 'self', NULL, 1,
    '{"name":"B first"}', '[{"name":"B first"}]', bus_b, 'app', form_version);
  registrations := array_append(registrations, result.registration_id);
  PERFORM pg_temp.vehicle_actor(admin_id);
  SELECT count(*) INTO before_failed_submit_count FROM public.event_registrations r WHERE r.event_id = selected_event;
  SELECT count(*) INTO original_audit_count FROM public.event_registration_audit_logs a WHERE a.event_id = selected_event;
  PERFORM pg_temp.vehicle_actor(people[4]);
  caught := FALSE;
  BEGIN
    PERFORM * FROM public.submit_event_registration_checked(selected_event, 'self', NULL, 1,
      '{"name":"Stale A selection"}', '[{"name":"Stale A selection"}]', bus_a, 'app', form_version);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%selected vehicle no longer has enough seats%' THEN RAISE; END IF;
    caught := TRUE;
  END;
  PERFORM pg_temp.vehicle_actor(admin_id);
  PERFORM pg_temp.vehicle_check('seat taken after selection is rejected without registration attendee or audit writes',
    caught AND (SELECT count(*) FROM public.event_registrations r WHERE r.event_id = selected_event) = before_failed_submit_count
    AND NOT EXISTS(SELECT 1 FROM public.event_registrations r WHERE r.event_id = selected_event AND r.user_id = people[4])
    AND (SELECT count(*) FROM public.event_registration_attendees a JOIN public.event_registrations r ON r.id = a.registration_id
      WHERE r.event_id = selected_event) = before_failed_submit_count
    AND (SELECT count(*) FROM public.event_registration_audit_logs a WHERE a.event_id = selected_event) = original_audit_count);
  PERFORM pg_temp.vehicle_actor(people[4]);
  SELECT * INTO result FROM public.submit_event_registration_checked(selected_event, 'self', NULL, 1,
    '{"name":"B second"}', '[{"name":"B second"}]', bus_b, 'app', form_version);
  registrations := array_append(registrations, result.registration_id);
  PERFORM pg_temp.vehicle_check('same user can choose remaining B seat after failed A submission',
    result.registration_status = 'confirmed' AND result.assigned_vehicle_id = bus_b);

  FOR num IN 5..6 LOOP
    PERFORM pg_temp.vehicle_actor(people[num]);
    SELECT * INTO result FROM public.submit_event_registration_checked(selected_event, 'self', NULL, 1,
      jsonb_build_object('name', 'Waiter ' || num::TEXT), jsonb_build_array(jsonb_build_object('name', 'Waiter ' || num::TEXT)),
      CASE WHEN num = 5 THEN bus_a ELSE bus_b END, 'app', form_version);
    registrations := array_append(registrations, result.registration_id);
    IF result.registration_status <> 'waitlist' OR result.assigned_vehicle_id IS NOT NULL THEN
      RAISE EXCEPTION 'Full-capacity fixture user % did not enter waitlist.', num;
    END IF;
  END LOOP;
  PERFORM pg_temp.vehicle_actor(admin_id);
  PERFORM pg_temp.vehicle_check('waitlist retains distinct A and B preferences without occupying seats',
    (SELECT r.requested_vehicle_id = bus_a AND r.vehicle_id IS NULL FROM public.event_registrations r WHERE r.id = registrations[5])
    AND (SELECT r.requested_vehicle_id = bus_b AND r.vehicle_id IS NULL FROM public.event_registrations r WHERE r.id = registrations[6])
    AND (SELECT count(*) FROM public.event_registrations r WHERE r.event_id = selected_event AND r.status = 'confirmed') = 4
    AND (SELECT count(*) FROM public.event_registrations r WHERE r.event_id = selected_event AND r.vehicle_id = bus_a AND r.status = 'confirmed') = 2);

  PERFORM pg_temp.vehicle_actor(people[5]);
  SELECT * INTO registration_row FROM public.event_registrations r WHERE r.id = registrations[5];
  PERFORM * FROM public.update_event_registration(registration_row.id, NULL, 1,
    registration_row.answers || '{"phone":"+39051234567"}', '[{"name":"Waiter 5"}]', NULL, registration_row.revision);
  PERFORM pg_temp.vehicle_check('waiter can edit answers without losing requested bus or becoming confirmed',
    (SELECT r.status = 'waitlist' AND r.vehicle_id IS NULL AND r.requested_vehicle_id = bus_a
      AND r.answers ->> 'phone' = '+39051234567' FROM public.event_registrations r WHERE r.id = registrations[5]));

  PERFORM pg_temp.vehicle_actor(people[3]);
  PERFORM public.cancel_event_registration(registrations[3]);
  PERFORM pg_temp.vehicle_actor(admin_id);
  PERFORM pg_temp.vehicle_check('B cancellation promotes B waiter and never moves A waiter to B',
    (SELECT r.status = 'confirmed' AND r.vehicle_id = bus_b FROM public.event_registrations r WHERE r.id = registrations[6])
    AND (SELECT r.status = 'waitlist' AND r.requested_vehicle_id = bus_a FROM public.event_registrations r WHERE r.id = registrations[5])
    AND (SELECT r.status = 'cancelled' AND r.vehicle_id = bus_b FROM public.event_registrations r WHERE r.id = registrations[3]));
  PERFORM pg_temp.vehicle_actor(people[1]);
  PERFORM public.cancel_event_registration(registrations[1]);
  PERFORM pg_temp.vehicle_actor(admin_id);
  PERFORM pg_temp.vehicle_check('A cancellation promotes A waiter within usable rather than total capacity',
    (SELECT r.status = 'confirmed' AND r.vehicle_id = bus_a FROM public.event_registrations r WHERE r.id = registrations[5])
    AND (SELECT count(*) FROM public.event_registrations r WHERE r.event_id = selected_event AND r.vehicle_id = bus_a AND r.status = 'confirmed') = 2);

  SELECT * INTO registration_row FROM public.event_registrations r WHERE r.id = registrations[2];
  original_registration := to_jsonb(registration_row);
  SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id) INTO original_attendees FROM public.event_registration_attendees a WHERE a.registration_id = registration_row.id;
  SELECT count(*) INTO original_audit_count FROM public.event_registration_audit_logs a WHERE a.registration_id = registration_row.id;
  caught := FALSE;
  BEGIN
    PERFORM public.admin_update_event_registration_full(registration_row.id, 'Must roll back', '+39051999999', 'rollback@example.invalid',
      registration_row.answers || '{"name":"Must roll back"}', NULL, bus_b, FALSE, registration_row.revision);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%vehicle does not have enough seats%' THEN RAISE; END IF;
    caught := TRUE;
  END;
  PERFORM pg_temp.vehicle_check('administrator full-bus transfer atomically preserves answers contacts revision assignment and audit',
    caught AND (SELECT to_jsonb(r) FROM public.event_registrations r WHERE r.id = registrations[2]) = original_registration
    AND (SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id) FROM public.event_registration_attendees a WHERE a.registration_id = registrations[2]) = original_attendees
    AND (SELECT count(*) FROM public.event_registration_audit_logs a WHERE a.registration_id = registrations[2]) = original_audit_count);

  PERFORM pg_temp.vehicle_actor(people[4]);
  PERFORM public.cancel_event_registration(registrations[4]);
  PERFORM pg_temp.vehicle_actor(admin_id);
  SELECT * INTO registration_row FROM public.event_registrations r WHERE r.id = registrations[2];
  PERFORM public.admin_update_event_registration_full(registration_row.id, 'A passenger moved to B', NULL, NULL,
    registration_row.answers || '{"name":"A passenger moved to B"}', NULL, bus_b, FALSE, registration_row.revision);
  PERFORM pg_temp.vehicle_check('administrator transfer succeeds once B seat is available and updates preference',
    (SELECT r.status = 'confirmed' AND r.vehicle_id = bus_b AND r.requested_vehicle_id = bus_b
      AND r.answers ->> 'name' = 'A passenger moved to B' FROM public.event_registrations r WHERE r.id = registrations[2]));
  PERFORM pg_temp.vehicle_actor(people[2]);
  PERFORM public.cancel_event_registration(registrations[2]);
  PERFORM pg_temp.vehicle_actor(admin_id);
  PERFORM pg_temp.vehicle_check('cancellation after transfer retains actual last bus B and releases its place',
    (SELECT r.status = 'cancelled' AND r.vehicle_id = bus_b FROM public.event_registrations r WHERE r.id = registrations[2])
    AND (SELECT count(*) FROM public.event_registrations r WHERE r.event_id = selected_event AND r.vehicle_id = bus_b AND r.status = 'confirmed') = 1);
  snapshot := public.admin_event_registration_snapshot(selected_event);
  SELECT value INTO snapshot_registration FROM jsonb_array_elements(snapshot -> 'registrations')
    WHERE value ->> 'id' = registrations[2]::TEXT;
  PERFORM pg_temp.vehicle_check('export includes all six records and accurate cancelled transfer history',
    jsonb_array_length(snapshot -> 'registrations') = 6 AND jsonb_array_length(snapshot -> 'vehicles') = 2
    AND snapshot_registration ->> 'status' = 'cancelled' AND snapshot_registration ->> 'vehicle_id' = bus_b::TEXT
    AND snapshot_registration -> 'answers' ->> 'name' = 'A passenger moved to B'
    AND jsonb_array_length(snapshot_registration -> 'attendees') = 1);

  manual_event := public.admin_save_event_config(NULL, payload || jsonb_build_object(
    'title', '[ROLLBACK VEHICLE TEST ' || run_id::TEXT || '] administrator assignment',
    'max_participants', 1, 'vehicle_selection_mode', 'admin'),
    '[{"name":"Fixture manual bus","capacity":2,"reserved_seats":1,"sort_order":0}]', NULL);
  SELECT v.id INTO manual_bus FROM public.event_vehicles v WHERE v.event_id = manual_event AND v.sort_order = 0;
  SELECT e.registration_form_version INTO form_version FROM public.events e WHERE e.id = manual_event;
  PERFORM pg_temp.vehicle_actor(people[7]);
  SELECT * INTO result FROM public.submit_event_registration_checked(manual_event, 'self', NULL, 1,
    '{"name":"Manual first"}', '[{"name":"Manual first"}]', NULL, 'app', form_version);
  manual_confirmed := result.registration_id;
  PERFORM pg_temp.vehicle_check('administrator mode initially confirms within event limit without automatic bus',
    result.registration_status = 'confirmed' AND result.assigned_vehicle_id IS NULL);
  PERFORM pg_temp.vehicle_actor(people[8]);
  SELECT * INTO result FROM public.submit_event_registration_checked(manual_event, 'self', NULL, 1,
    '{"name":"Manual waiter"}', '[{"name":"Manual waiter"}]', NULL, 'app', form_version);
  manual_waiter := result.registration_id;
  PERFORM pg_temp.vehicle_check('administrator mode respects event cap with a waiter', result.registration_status = 'waitlist');
  PERFORM pg_temp.vehicle_actor(people[7]);
  PERFORM public.cancel_event_registration(manual_confirmed);
  PERFORM pg_temp.vehicle_actor(people[8]);
  SELECT * INTO registration_row FROM public.event_registrations r WHERE r.id = manual_waiter;
  PERFORM * FROM public.update_event_registration(manual_waiter, NULL, 1,
    registration_row.answers || '{"phone":"+39051111111"}', '[{"name":"Manual waiter"}]', NULL, registration_row.revision);
  PERFORM pg_temp.vehicle_check('cancellation and answer edits do not automatically confirm administrator-mode waiter',
    (SELECT r.status = 'waitlist' AND r.vehicle_id IS NULL AND r.answers ->> 'phone' = '+39051111111'
      FROM public.event_registrations r WHERE r.id = manual_waiter));
  PERFORM pg_temp.vehicle_actor(people[9]);
  SELECT * INTO result FROM public.submit_event_registration_checked(manual_event, 'self', NULL, 1,
    '{"name":"Manual newcomer"}', '[{"name":"Manual newcomer"}]', NULL, 'app', form_version);
  manual_newcomer := result.registration_id;
  PERFORM pg_temp.vehicle_check('newcomer cannot bypass pending administrator decision', result.registration_status = 'waitlist');
  PERFORM pg_temp.vehicle_actor(admin_id);
  caught := FALSE;
  BEGIN
    PERFORM public.admin_promote_event_registration(manual_waiter);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%assign a vehicle before promoting%' THEN RAISE; END IF;
    caught := TRUE;
  END;
  PERFORM pg_temp.vehicle_check('manual promotion in administrator mode requires an explicit vehicle',
    caught AND (SELECT r.status = 'waitlist' AND r.vehicle_id IS NULL FROM public.event_registrations r WHERE r.id = manual_waiter));
  SELECT * INTO registration_row FROM public.event_registrations r WHERE r.id = manual_waiter;
  PERFORM public.admin_update_event_registration_full(manual_waiter, 'Manual waiter', NULL, NULL,
    registration_row.answers, NULL, manual_bus, FALSE, registration_row.revision);
  PERFORM pg_temp.vehicle_check('explicit administrator assignment promotes only selected waiter',
    (SELECT r.status = 'confirmed' AND r.vehicle_id = manual_bus FROM public.event_registrations r WHERE r.id = manual_waiter)
    AND (SELECT r.status = 'waitlist' AND r.vehicle_id IS NULL FROM public.event_registrations r WHERE r.id = manual_newcomer));
  PERFORM public.admin_cancel_event_registration(manual_waiter, FALSE);
  SELECT * INTO event_row FROM public.events e WHERE e.id = manual_event;
  PERFORM public.admin_save_event_config(manual_event, to_jsonb(event_row) || '{"registration_status":"closed"}',
    (SELECT jsonb_agg(to_jsonb(v) ORDER BY v.sort_order, v.id) FROM public.event_vehicles v WHERE v.event_id = manual_event), event_row.revision);
  PERFORM pg_temp.vehicle_check('administrator cancellation and closing leave remaining waiter for manual action',
    (SELECT r.status = 'waitlist' FROM public.event_registrations r WHERE r.id = manual_newcomer));
  SELECT * INTO registration_row FROM public.event_registrations r WHERE r.id = manual_newcomer;
  PERFORM public.admin_update_event_registration_full(manual_newcomer, 'Manual newcomer', NULL, NULL,
    registration_row.answers, NULL, manual_bus, FALSE, registration_row.revision);
  PERFORM pg_temp.vehicle_check('administrator can explicitly assign and confirm after registration closes',
    (SELECT r.status = 'confirmed' AND r.vehicle_id = manual_bus FROM public.event_registrations r WHERE r.id = manual_newcomer)
    AND (SELECT count(*) FROM public.event_registrations r WHERE r.event_id = manual_event AND r.status = 'confirmed') = 1
    AND (SELECT r.status = 'cancelled' AND r.vehicle_id = manual_bus FROM public.event_registrations r WHERE r.id = manual_waiter));

  PERFORM pg_temp.vehicle_check('fixture notification switches remain off and no delivery jobs exist',
    NOT EXISTS(SELECT 1 FROM public.events e WHERE e.id IN(selected_event, manual_event) AND e.registration_start_notify_enabled)
    AND NOT EXISTS(SELECT 1 FROM public.event_registration_notification_jobs j WHERE j.event_id IN(selected_event, manual_event)));
  EXECUTE 'RESET ROLE';
  PERFORM pg_temp.vehicle_check('fixture cardinality remains ten users two events and nine independent registrations',
    (SELECT count(*) FROM auth.users u WHERE u.id = ANY(user_ids)) = 10
    AND (SELECT count(*) FROM public.events e WHERE e.id IN(selected_event, manual_event)) = 2
    AND (SELECT count(*) FROM public.event_registrations r WHERE r.event_id IN(selected_event, manual_event)) = 9,
    jsonb_build_object('run_id', run_id, 'event_ids', jsonb_build_array(selected_event, manual_event), 'user_ids', to_jsonb(user_ids)));
  RAISE NOTICE 'Vehicle rollback fixture run % passed; final statement will discard all changes.', run_id;
END;
$vehicle_test$;

SELECT jsonb_build_object(
  'test', 'event_registration_live_vehicles_transaction_rollback',
  'passed', bool_and(passed),
  'checks', count(*),
  'results', jsonb_agg(jsonb_build_object('test', test, 'passed', passed, 'details', details) ORDER BY test),
  'scope', 'Deployed authenticated RPCs; sequential stale-seat, preference, administrator-assignment and history checks; no real concurrent connections or Expo requests.',
  'cleanup', 'Final ROLLBACK removes every fixture user, profile, activity, vehicle, registration, attendee, audit entry and temporary test object.'
) AS test_report
FROM pg_temp.event_vehicle_live_results;

ROLLBACK;
