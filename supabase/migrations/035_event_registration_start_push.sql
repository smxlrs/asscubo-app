-- Optional one-time Expo Push when an event's scheduled registration start is reached.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS registration_start_notify_enabled BOOLEAN NOT NULL DEFAULT FALSE;
