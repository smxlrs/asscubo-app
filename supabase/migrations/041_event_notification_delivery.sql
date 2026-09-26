-- A durable, bounded notification job exists only for an explicitly enabled event.
-- No global polling job is created. Accepted Expo tickets are not sent again.
BEGIN;
CREATE TABLE IF NOT EXISTS public.event_registration_notification_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  scheduled_for TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'partial', 'failed', 'cancelled')),
  attempts INTEGER NOT NULL DEFAULT 0,
  targets_initialized BOOLEAN NOT NULL DEFAULT FALSE,
  lease_token UUID,
  lease_until TIMESTAMPTZ,
  next_attempt_at TIMESTAMPTZ,
  last_request_id BIGINT,
  sent_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, scheduled_for)
);

CREATE TABLE IF NOT EXISTS public.event_registration_notification_targets (
  job_id UUID NOT NULL REFERENCES public.event_registration_notification_jobs(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  ticket_id TEXT,
  last_error TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (job_id, token)
);
ALTER TABLE public.event_registration_notification_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_registration_notification_targets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.event_registration_notification_jobs, public.event_registration_notification_targets FROM anon, authenticated;
GRANT SELECT ON public.event_registration_notification_jobs TO authenticated;
DROP POLICY IF EXISTS "Event managers can read notification delivery status" ON public.event_registration_notification_jobs;
CREATE POLICY "Event managers can read notification delivery status" ON public.event_registration_notification_jobs
  FOR SELECT TO authenticated USING (public.has_admin_permission('events.manage'));

CREATE OR REPLACE FUNCTION public.unschedule_event_notification_job(p_event_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE job_id BIGINT;
BEGIN
  SELECT jobid INTO job_id FROM cron.job
  WHERE jobname = 'event-registration-start-' || replace(p_event_id::TEXT, '-', '') LIMIT 1;
  IF job_id IS NOT NULL THEN PERFORM cron.unschedule(job_id); END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.unschedule_event_notification_job(UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.enqueue_event_notification_job(p_job_id UUID, p_run_at TIMESTAMPTZ)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE job_row public.event_registration_notification_jobs%ROWTYPE; run_at TIMESTAMPTZ; expression TEXT;
BEGIN
  SELECT * INTO job_row FROM public.event_registration_notification_jobs WHERE id = p_job_id;
  IF job_row.id IS NULL THEN RETURN; END IF;
  -- Round up, never down: a time containing seconds must not miss its yearly cron slot.
  run_at := greatest(p_run_at, clock_timestamp());
  IF date_trunc('minute', run_at) < run_at THEN
    run_at := date_trunc('minute', run_at) + interval '1 minute';
  END IF;
  expression := format('%s %s %s %s *',
    extract(minute FROM run_at AT TIME ZONE 'UTC')::INTEGER,
    extract(hour FROM run_at AT TIME ZONE 'UTC')::INTEGER,
    extract(day FROM run_at AT TIME ZONE 'UTC')::INTEGER,
    extract(month FROM run_at AT TIME ZONE 'UTC')::INTEGER);
  UPDATE public.event_registration_notification_jobs SET next_attempt_at = run_at, updated_at = now() WHERE id = p_job_id;
  PERFORM cron.schedule('event-registration-start-' || replace(job_row.event_id::TEXT, '-', ''), expression,
    format('SELECT public.dispatch_event_notification_job(%L::uuid);', p_job_id::TEXT));
END;
$$;
REVOKE ALL ON FUNCTION public.enqueue_event_notification_job(UUID, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.schedule_event_registration_notification_internal(p_event_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE event_row public.events%ROWTYPE; job_row public.event_registration_notification_jobs%ROWTYPE;
BEGIN
  SELECT * INTO event_row FROM public.events WHERE id = p_event_id FOR UPDATE;
  IF event_row.id IS NULL THEN RETURN FALSE; END IF;
  IF NOT event_row.is_published OR event_row.deleted_at IS NOT NULL
     OR event_row.registration_status <> 'open' OR NOT event_row.registration_start_notify_enabled
     OR event_row.registration_start_at IS NULL OR clock_timestamp() > event_row.end_time
     OR (event_row.registration_deadline IS NOT NULL AND clock_timestamp() > event_row.registration_deadline) THEN
    UPDATE public.event_registration_notification_jobs SET status = 'cancelled',
      next_attempt_at = NULL, updated_at = now()
    WHERE event_id = p_event_id AND status IN ('pending', 'processing');
    PERFORM public.unschedule_event_notification_job(p_event_id);
    RETURN FALSE;
  END IF;
  UPDATE public.event_registration_notification_jobs SET status = 'cancelled',
    next_attempt_at = NULL, updated_at = now()
  WHERE event_id = p_event_id AND scheduled_for <> event_row.registration_start_at AND status IN ('pending', 'processing');
  INSERT INTO public.event_registration_notification_jobs(event_id, scheduled_for)
  VALUES (p_event_id, event_row.registration_start_at) ON CONFLICT (event_id, scheduled_for) DO NOTHING;
  SELECT * INTO job_row FROM public.event_registration_notification_jobs
  WHERE event_id = p_event_id AND scheduled_for = event_row.registration_start_at FOR UPDATE;
  -- Re-saving or toggling an already completed schedule never repeats its broadcast.
  IF job_row.status IN ('sent', 'partial', 'failed') THEN
    PERFORM public.unschedule_event_notification_job(p_event_id);
    RETURN FALSE;
  END IF;
  IF job_row.status = 'cancelled' THEN
    -- Let an interrupted worker record any already accepted tickets before a
    -- replacement can send. A quick off/on toggle must not replay that batch.
    IF job_row.lease_until > clock_timestamp() THEN
      UPDATE public.event_registration_notification_jobs SET status = 'processing', last_error = NULL,
        updated_at = now() WHERE id = job_row.id;
      PERFORM public.enqueue_event_notification_job(job_row.id, job_row.lease_until);
      RETURN TRUE;
    END IF;
    UPDATE public.event_registration_notification_jobs SET status = 'pending', attempts = 0,
      lease_token = NULL, lease_until = NULL, last_error = NULL, updated_at = now() WHERE id = job_row.id;
  ELSIF job_row.status = 'processing' AND job_row.lease_until > clock_timestamp() THEN
    RETURN TRUE;
  END IF;
  PERFORM public.enqueue_event_notification_job(job_row.id,
    greatest(event_row.registration_start_at, COALESCE(job_row.next_attempt_at, event_row.registration_start_at)));
  RETURN TRUE;
END;
$$;
REVOKE ALL ON FUNCTION public.schedule_event_registration_notification_internal(UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.schedule_event_registration_start_notification(p_event_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT public.has_admin_permission('events.manage') THEN RAISE EXCEPTION 'Event management permission is required.'; END IF;
  RETURN public.schedule_event_registration_notification_internal(p_event_id);
END;
$$;
REVOKE ALL ON FUNCTION public.schedule_event_registration_start_notification(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.schedule_event_registration_start_notification(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.dispatch_event_notification_job(p_job_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE event_row public.events%ROWTYPE; job_row public.event_registration_notification_jobs%ROWTYPE;
  target_event UUID; request_id BIGINT; secret_key TEXT;
BEGIN
  SELECT event_id INTO target_event FROM public.event_registration_notification_jobs WHERE id = p_job_id;
  IF target_event IS NULL THEN RETURN; END IF;
  SELECT * INTO event_row FROM public.events WHERE id = target_event FOR UPDATE;
  SELECT * INTO job_row FROM public.event_registration_notification_jobs WHERE id = p_job_id FOR UPDATE;
  IF job_row.status NOT IN ('pending', 'processing') THEN RETURN; END IF;
  IF NOT event_row.is_published OR event_row.deleted_at IS NOT NULL
     OR event_row.registration_status <> 'open' OR NOT event_row.registration_start_notify_enabled
     OR event_row.registration_start_at IS DISTINCT FROM job_row.scheduled_for
     OR clock_timestamp() > event_row.end_time
     OR (event_row.registration_deadline IS NOT NULL AND clock_timestamp() > event_row.registration_deadline) THEN
    UPDATE public.event_registration_notification_jobs SET status = 'cancelled', next_attempt_at = NULL,
      updated_at = now() WHERE id = p_job_id;
    PERFORM public.unschedule_event_notification_job(target_event);
    RETURN;
  END IF;
  IF job_row.scheduled_for > clock_timestamp() THEN
    PERFORM public.enqueue_event_notification_job(p_job_id, job_row.scheduled_for); RETURN;
  END IF;
  IF job_row.status = 'processing' AND job_row.lease_until > clock_timestamp() THEN
    PERFORM public.enqueue_event_notification_job(p_job_id, job_row.lease_until); RETURN;
  END IF;
  IF job_row.attempts >= 5 THEN
    UPDATE public.event_registration_notification_targets SET status = 'failed',
      last_error = 'Retry limit reached.', updated_at = now() WHERE job_id = p_job_id AND status = 'pending';
    UPDATE public.event_registration_notification_jobs SET status = CASE WHEN sent_count > 0 THEN 'partial' ELSE 'failed' END,
      failed_count = (SELECT count(*) FROM public.event_registration_notification_targets WHERE job_id = p_job_id AND status = 'failed'),
      last_error = 'Automatic notification failed after five attempts. Please send manually if needed.',
      next_attempt_at = NULL, lease_token = NULL, lease_until = NULL, updated_at = now() WHERE id = p_job_id;
    PERFORM public.unschedule_event_notification_job(target_event); RETURN;
  END IF;
  UPDATE public.event_registration_notification_jobs SET attempts = attempts + 1, status = 'pending',
    lease_token = NULL, lease_until = NULL, updated_at = now() WHERE id = p_job_id;
  -- A watchdog remains even if the HTTP request or the worker fails before acknowledging anything.
  PERFORM public.enqueue_event_notification_job(p_job_id, clock_timestamp() + interval '5 minutes');
  SELECT decrypted_secret INTO secret_key FROM vault.decrypted_secrets
  WHERE name = 'event_registration_start_secret_key' LIMIT 1;
  IF secret_key IS NULL THEN
    UPDATE public.event_registration_notification_jobs SET last_error = 'Notification secret is missing.' WHERE id = p_job_id;
    RETURN;
  END IF;
  BEGIN
    SELECT net.http_post(
      url := 'https://avxzgaozbfeqttmhmlld.supabase.co/functions/v1/event-registration-start-notifications',
      headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', secret_key),
      body := jsonb_build_object('job_id', p_job_id), timeout_milliseconds := 120000
    ) INTO request_id;
    UPDATE public.event_registration_notification_jobs SET last_request_id = request_id WHERE id = p_job_id;
  EXCEPTION WHEN OTHERS THEN
    UPDATE public.event_registration_notification_jobs SET last_error = 'Could not dispatch notification worker.' WHERE id = p_job_id;
  END;
END;
$$;
REVOKE ALL ON FUNCTION public.dispatch_event_notification_job(UUID) FROM PUBLIC, anon, authenticated;

-- Keep old cron invocations harmless during rollout.
CREATE OR REPLACE FUNCTION public.dispatch_event_registration_start_notification(p_event_id UUID, p_job_name TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE job_id UUID;
BEGIN
  SELECT id INTO job_id FROM public.event_registration_notification_jobs
  WHERE event_id = p_event_id AND status IN ('pending', 'processing') ORDER BY created_at DESC LIMIT 1;
  IF job_id IS NOT NULL THEN PERFORM public.dispatch_event_notification_job(job_id);
  ELSE PERFORM public.unschedule_event_notification_job(p_event_id); END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.dispatch_event_registration_start_notification(UUID, TEXT) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.claim_event_registration_notification(p_job_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE event_row public.events%ROWTYPE; job_row public.event_registration_notification_jobs%ROWTYPE;
  target_event UUID; claim_token UUID; tokens JSONB;
BEGIN
  SELECT event_id INTO target_event FROM public.event_registration_notification_jobs WHERE id = p_job_id;
  IF target_event IS NULL THEN RETURN jsonb_build_object('claimed', FALSE); END IF;
  SELECT * INTO event_row FROM public.events WHERE id = target_event FOR UPDATE;
  SELECT * INTO job_row FROM public.event_registration_notification_jobs WHERE id = p_job_id FOR UPDATE;
  IF job_row.status NOT IN ('pending', 'processing') OR (job_row.lease_until > clock_timestamp()) THEN
    RETURN jsonb_build_object('claimed', FALSE, 'status', job_row.status);
  END IF;
  IF NOT event_row.is_published OR event_row.deleted_at IS NOT NULL OR event_row.registration_status <> 'open'
     OR NOT event_row.registration_start_notify_enabled OR event_row.registration_start_at IS DISTINCT FROM job_row.scheduled_for
     OR clock_timestamp() < job_row.scheduled_for OR clock_timestamp() > event_row.end_time
     OR (event_row.registration_deadline IS NOT NULL AND clock_timestamp() > event_row.registration_deadline) THEN
    RETURN jsonb_build_object('claimed', FALSE, 'status', 'not_available');
  END IF;
  IF NOT job_row.targets_initialized THEN
    INSERT INTO public.event_registration_notification_targets(job_id, token)
    SELECT p_job_id, token FROM public.push_tokens WHERE NULLIF(btrim(token), '') IS NOT NULL
    GROUP BY token ON CONFLICT DO NOTHING;
  END IF;
  claim_token := gen_random_uuid();
  UPDATE public.event_registration_notification_jobs SET status = 'processing', targets_initialized = TRUE,
    attempts = greatest(attempts, 1), lease_token = claim_token, lease_until = clock_timestamp() + interval '3 minutes',
    updated_at = now() WHERE id = p_job_id;
  SELECT COALESCE(jsonb_agg(token ORDER BY token), '[]'::JSONB) INTO tokens
  FROM public.event_registration_notification_targets WHERE job_id = p_job_id AND status = 'pending';
  RETURN jsonb_build_object('claimed', TRUE, 'lease_token', claim_token, 'event_id', target_event,
    'title', event_row.title, 'tokens', tokens);
END;
$$;
REVOKE ALL ON FUNCTION public.claim_event_registration_notification(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_event_registration_notification(UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.record_event_registration_notification_batch(p_job_id UUID, p_lease_token UUID, p_results JSONB)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE job_row public.event_registration_notification_jobs%ROWTYPE; item JSONB; current_claim BOOLEAN;
BEGIN
  SELECT * INTO job_row FROM public.event_registration_notification_jobs WHERE id = p_job_id FOR UPDATE;
  IF job_row.id IS NULL THEN RETURN FALSE; END IF;
  current_claim := job_row.status = 'processing' AND job_row.lease_token IS NOT DISTINCT FROM p_lease_token;
  IF jsonb_typeof(p_results) <> 'array' OR jsonb_array_length(p_results) > 100 THEN RAISE EXCEPTION 'Invalid notification batch.'; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(p_results) LOOP
    IF (item ->> 'status') NOT IN ('sent', 'failed', 'pending') THEN RAISE EXCEPTION 'Invalid notification outcome.'; END IF;
    IF NOT current_claim THEN
      -- A request can finish after an administrator cancels its job. Known
      -- accepted tickets are monotonic facts; save them without authorizing
      -- the stale worker to send another batch or overwrite failures.
      IF item ->> 'status' = 'sent' AND NULLIF(item ->> 'ticket_id', '') IS NOT NULL THEN
        UPDATE public.event_registration_notification_targets SET status = 'sent',
          ticket_id = item ->> 'ticket_id', last_error = NULL, updated_at = now()
        WHERE job_id = p_job_id AND token = item ->> 'token' AND status <> 'sent';
      END IF;
      CONTINUE;
    END IF;
    UPDATE public.event_registration_notification_targets SET status = item ->> 'status',
      ticket_id = item ->> 'ticket_id', last_error = left(item ->> 'error', 500), updated_at = now()
    WHERE job_id = p_job_id AND token = item ->> 'token' AND status = 'pending';
  END LOOP;
  UPDATE public.event_registration_notification_jobs SET
    sent_count = (SELECT count(*) FROM public.event_registration_notification_targets WHERE job_id = p_job_id AND status = 'sent'),
    failed_count = (SELECT count(*) FROM public.event_registration_notification_targets WHERE job_id = p_job_id AND status = 'failed'),
    -- Late accepted tickets can arrive after the watchdog exhausted retries.
    -- Keep cancelled jobs cancelled, but make terminal results match the facts.
    status = CASE WHEN status IN ('failed', 'partial') THEN
      CASE WHEN NOT EXISTS (SELECT 1 FROM public.event_registration_notification_targets WHERE job_id = p_job_id AND status <> 'sent') THEN 'sent'
        WHEN EXISTS (SELECT 1 FROM public.event_registration_notification_targets WHERE job_id = p_job_id AND status = 'sent') THEN 'partial'
        ELSE status END
      ELSE status END,
    last_error = CASE WHEN status IN ('failed', 'partial') AND NOT EXISTS
      (SELECT 1 FROM public.event_registration_notification_targets WHERE job_id = p_job_id AND status <> 'sent')
      THEN NULL ELSE last_error END,
    updated_at = now() WHERE id = p_job_id;
  RETURN current_claim;
END;
$$;
REVOKE ALL ON FUNCTION public.record_event_registration_notification_batch(UUID, UUID, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_event_registration_notification_batch(UUID, UUID, JSONB) TO service_role;

CREATE OR REPLACE FUNCTION public.finish_event_registration_notification(p_job_id UUID, p_lease_token UUID, p_error TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE job_row public.event_registration_notification_jobs%ROWTYPE; pending_count INTEGER; sent INTEGER; failed INTEGER; next_status TEXT;
BEGIN
  SELECT * INTO job_row FROM public.event_registration_notification_jobs WHERE id = p_job_id FOR UPDATE;
  IF job_row.status <> 'processing' OR job_row.lease_token IS DISTINCT FROM p_lease_token THEN
    RETURN jsonb_build_object('status', 'stale');
  END IF;
  IF job_row.attempts >= 5 THEN
    UPDATE public.event_registration_notification_targets SET status = 'failed',
      last_error = COALESCE(last_error, 'Retry limit reached.'), updated_at = now()
    WHERE job_id = p_job_id AND status = 'pending';
  END IF;
  SELECT count(*) FILTER (WHERE status = 'pending'), count(*) FILTER (WHERE status = 'sent'), count(*) FILTER (WHERE status = 'failed')
  INTO pending_count, sent, failed FROM public.event_registration_notification_targets WHERE job_id = p_job_id;
  next_status := CASE WHEN pending_count > 0 THEN 'pending' WHEN failed = 0 THEN 'sent' WHEN sent > 0 THEN 'partial' ELSE 'failed' END;
  UPDATE public.event_registration_notification_jobs SET status = next_status, sent_count = sent, failed_count = failed,
    lease_token = NULL, lease_until = NULL, next_attempt_at = NULL,
    last_error = CASE WHEN next_status = 'sent' THEN NULL ELSE COALESCE(left(p_error, 500), 'Some notifications were not accepted.') END,
    updated_at = now() WHERE id = p_job_id;
  IF next_status = 'pending' THEN
    PERFORM public.enqueue_event_notification_job(p_job_id, clock_timestamp() + interval '5 minutes');
  ELSE
    PERFORM public.unschedule_event_notification_job(job_row.event_id);
  END IF;
  RETURN jsonb_build_object('status', next_status, 'sent', sent, 'failed', failed, 'pending', pending_count);
END;
$$;
REVOKE ALL ON FUNCTION public.finish_event_registration_notification(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finish_event_registration_notification(UUID, UUID, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.sync_event_registration_notification_job()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM public.schedule_event_registration_notification_internal(NEW.id);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.sync_event_registration_notification_job() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS events_registration_notification_schedule ON public.events;
CREATE TRIGGER events_registration_notification_schedule
AFTER INSERT OR UPDATE OF is_published, registration_status, registration_start_at,
  registration_start_notify_enabled, registration_deadline, end_time, deleted_at ON public.events
FOR EACH ROW EXECUTE FUNCTION public.sync_event_registration_notification_job();

-- Replace existing per-event schedules; there is still no task when none is enabled.
DO $backfill$
DECLARE event_row RECORD;
BEGIN
  FOR event_row IN SELECT id FROM public.events ORDER BY id LOOP
    PERFORM public.schedule_event_registration_notification_internal(event_row.id);
  END LOOP;
END;
$backfill$;

NOTIFY pgrst, 'reload schema';
COMMIT;
