-- Allow administrators to explicitly mark an event as ended. Archived events
-- remain private; ended events stay visible but cannot accept registrations.
ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_registration_status_check;

ALTER TABLE public.events
  ADD CONSTRAINT events_registration_status_check
  CHECK (registration_status IN ('draft', 'open', 'closed', 'ended', 'archived'));

DROP POLICY IF EXISTS "Published events viewable by all" ON public.events;
CREATE POLICY "Published events viewable by all" ON public.events
  FOR SELECT TO anon, authenticated
  USING (
    is_published = TRUE
    AND deleted_at IS NULL
    AND registration_status IN ('open', 'closed', 'ended')
  );

DROP POLICY IF EXISTS "Public can view event vehicles" ON public.event_vehicles;
CREATE POLICY "Public can view event vehicles" ON public.event_vehicles
  FOR SELECT TO anon, authenticated
  USING (
    is_active = TRUE
    AND EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_vehicles.event_id
        AND e.is_published = TRUE
        AND e.deleted_at IS NULL
        AND e.registration_status IN ('open', 'closed', 'ended')
    )
  );
