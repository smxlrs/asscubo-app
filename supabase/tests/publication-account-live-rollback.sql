-- Random fixtures only. No site sync, emails, push or real-account operations.
BEGIN;
SET LOCAL statement_timeout = '60s';
SET LOCAL lock_timeout = '5s';
-- MIGRATION_PREVIEW
CREATE TEMP TABLE publication_account_results(test TEXT, passed BOOLEAN);
CREATE TEMP TABLE publication_account_fixture(run_id UUID, user_ids UUID[], article_ids UUID[], notification_ids UUID[]);
DO $test$
DECLARE run UUID := gen_random_uuid(); manager UUID := gen_random_uuid(); student UUID := gen_random_uuid();
  account_id UUID; article UUID := gen_random_uuid(); public_notice UUID := gen_random_uuid(); private_notice UUID := gen_random_uuid();
  prefix TEXT := '[PUBLICATION ROLLBACK '||run||']'; nonce TEXT := '123456'; n INTEGER;
BEGIN
  FOREACH account_id IN ARRAY ARRAY[manager,student] LOOP
    INSERT INTO auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,
      created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change,
      reauthentication_token,reauthentication_sent_at)
    VALUES(account_id,'authenticated','authenticated','publication-'||account_id||'@example.invalid','',now(),
      '{"provider":"email","providers":["email"]}',jsonb_build_object('name','Publication fixture'),now(),now(),'','','','',
      encode(sha224(convert_to('publication-'||account_id||'@example.invalid'||nonce,'UTF8')),'hex'),now());
  END LOOP;
  UPDATE public.profiles SET role='admin' WHERE id=manager;
  INSERT INTO public.admin_permissions(admin_id,permission,granted_by) VALUES(manager,'articles.manage',manager);
  INSERT INTO public.articles(id,title,content,summary,category,link,is_pinned,is_published,wordpress_post_id)
  VALUES(article,prefix||' article','Fixture','Old searchable fixture','general','https://asscubo.it/fixture-'||run||'/',TRUE,TRUE,
    8000000000000 + floor(random()*100000000000)::BIGINT);
  INSERT INTO public.notifications(id,title,content,category,target_type,target_value,created_at,is_pinned)
  VALUES(public_notice,prefix||' public','Fixture','general','all',NULL,now(),FALSE),
    (private_notice,prefix||' private','Fixture','general','user',manager::TEXT,now(),FALSE);
  INSERT INTO publication_account_fixture VALUES(run,ARRAY[manager,student],ARRAY[article],ARRAY[public_notice,private_notice]);

  PERFORM set_config('request.jwt.claim.sub','',TRUE);
  PERFORM set_config('request.jwt.claim.role','anon',TRUE);
  EXECUTE 'SET LOCAL ROLE anon';
  SELECT count(*) INTO n FROM public.publication_feed('all','all',prefix,0,16);
  IF n<>2 THEN RAISE EXCEPTION 'Anonymous feed search/RLS expected 2, got %',n; END IF;
  EXECUTE 'RESET ROLE';
  INSERT INTO publication_account_results VALUES('Anonymous search respects private notification scope',TRUE);

  PERFORM set_config('request.jwt.claim.sub',manager::TEXT,TRUE);
  PERFORM set_config('request.jwt.claim.role','authenticated',TRUE);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.publication_feed('all','all',prefix,0,16);
  IF n<>3 THEN RAISE EXCEPTION 'Recipient feed expected 3, got %',n; END IF;
  UPDATE public.articles SET is_published=FALSE WHERE id=article;
  IF NOT (SELECT admin_hidden FROM public.articles WHERE id=article) THEN RAISE EXCEPTION 'Legacy client hide not retained'; END IF;
  EXECUTE 'RESET ROLE';
  -- Simulate sync updating this fixture only; do not activate an entire source set.
  PERFORM set_config('request.jwt.claim.role','service_role',TRUE);
  UPDATE public.articles SET is_published=TRUE WHERE id=article;
  IF (SELECT is_published FROM public.articles WHERE id=article) THEN RAISE EXCEPTION 'Sync could resurrect a hidden article'; END IF;
  BEGIN
    DELETE FROM public.articles WHERE id=article;
    RAISE EXCEPTION 'Old cleanup could erase website identity';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  INSERT INTO publication_account_results VALUES('Recipient-only notifications and persistent administrator article hide',TRUE);

  PERFORM set_config('request.jwt.claim.sub',student::TEXT,TRUE);
  PERFORM set_config('request.jwt.claim.role','authenticated',TRUE);
  EXECUTE 'SET LOCAL ROLE authenticated';
  IF public.delete_user_account('000000') THEN RAISE EXCEPTION 'Wrong code accepted'; END IF;
  IF public.delete_user_account(NULL::TEXT) THEN RAISE EXCEPTION 'Missing code accepted'; END IF;
  IF NOT public.delete_user_account(nonce) THEN RAISE EXCEPTION 'Correct fresh code rejected'; END IF;
  EXECUTE 'RESET ROLE';
  IF EXISTS(SELECT 1 FROM auth.users WHERE id=student) OR EXISTS(SELECT 1 FROM public.profiles WHERE id=student)
    OR EXISTS(SELECT 1 FROM public.account_deletion_attempts WHERE user_id=student) THEN
    RAISE EXCEPTION 'Fixture account cascade incomplete';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=manager) THEN RAISE EXCEPTION 'Other account affected'; END IF;
  IF has_function_privilege('authenticated','public.delete_user_account()','EXECUTE')
    OR has_function_privilege('anon','public.delete_user_account(text)','EXECUTE') THEN RAISE EXCEPTION 'Unverified deletion path open'; END IF;
  INSERT INTO publication_account_results VALUES('Server verifies nonce, blocks legacy/anonymous paths and deletes only caller',TRUE);
END;
$test$;
SELECT jsonb_build_object('passed',(SELECT bool_and(passed) FROM publication_account_results),
  'results',(SELECT jsonb_agg(to_jsonb(r)) FROM publication_account_results r),
  'fixture',(SELECT to_jsonb(f) FROM publication_account_fixture f)) AS test_report;
ROLLBACK;
