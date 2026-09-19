-- Store whether an event has an end date and whether exact times should be shown.
-- Existing events retain the previous full date-time behavior through TRUE defaults.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS has_end_date BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS start_has_time BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS end_has_time BOOLEAN NOT NULL DEFAULT TRUE;
