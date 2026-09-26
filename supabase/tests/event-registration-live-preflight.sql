-- Read-only deployment and test-fixture prerequisites. No personal data or keys.
SELECT 'schema' AS section, jsonb_build_object(
  'server_version', current_setting('server_version'),
  'revision_columns', (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('events','event_registrations') AND column_name='revision'),
  'form_snapshot', EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='event_registrations' AND column_name='form_snapshot'),
  'jobs_rls', (SELECT relrowsecurity FROM pg_class WHERE oid=to_regclass('public.event_registration_notification_jobs')),
  'targets_rls', (SELECT relrowsecurity FROM pg_class WHERE oid=to_regclass('public.event_registration_notification_targets')),
  'audit_rls', (SELECT relrowsecurity FROM pg_class WHERE oid=to_regclass('public.event_registration_audit_logs')),
  'notification_secret_present', EXISTS(SELECT 1 FROM vault.secrets WHERE name='event_registration_start_secret_key'),
  'global_minute_poll_exists', EXISTS(SELECT 1 FROM cron.job WHERE jobname='event-registration-start-notifications')
) AS details
UNION ALL
SELECT 'functions', jsonb_agg(jsonb_build_object('name',p.proname,'arguments',pg_get_function_identity_arguments(p.oid),
  'authenticated_execute',has_function_privilege('authenticated',p.oid,'EXECUTE'),
  'anon_execute',has_function_privilege('anon',p.oid,'EXECUTE'), 'definition_md5',md5(pg_get_functiondef(p.oid))))
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname IN ('submit_event_registration_checked','submit_event_registration_group_checked',
  'submit_event_registration','submit_event_registration_group','update_event_registration','admin_save_event_config',
  'admin_update_event_registration_full','admin_assign_event_registration','promote_event_waitlist','admin_event_registration_page',
  'claim_event_registration_notification','record_event_registration_notification_batch','finish_event_registration_notification')
UNION ALL
SELECT 'fixture_columns', jsonb_agg(jsonb_build_object('table',table_schema||'.'||table_name,'column',column_name,'type',data_type,'default',column_default))
FROM information_schema.columns WHERE (table_schema='auth' AND table_name='users' OR table_schema='public' AND table_name='profiles')
AND is_nullable='NO'
UNION ALL
SELECT 'auth_triggers', jsonb_agg(jsonb_build_object('trigger',t.tgname,'definition',pg_get_triggerdef(t.oid),'function',p.proname,'body',pg_get_functiondef(p.oid)))
FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid
WHERE t.tgrelid='auth.users'::regclass AND NOT t.tgisinternal;
