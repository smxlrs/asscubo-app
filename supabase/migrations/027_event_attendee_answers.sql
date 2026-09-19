-- Store custom form answers for each person included in a registration.
-- The existing RPCs remain compatible: proxy submissions carry an internal
-- __attendee_answers array in event_registrations.answers, and this trigger
-- copies each person's answers to the matching attendee row.

ALTER TABLE public.event_registration_attendees
  ADD COLUMN IF NOT EXISTS answers JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.event_registration_attendees attendee
SET answers = registration.answers
FROM public.event_registrations registration
WHERE registration.id = attendee.registration_id
  AND attendee.answers = '{}'::jsonb
  AND registration.answers IS NOT NULL;

CREATE OR REPLACE FUNCTION public.sync_event_attendee_answers()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  registration_answers JSONB;
BEGIN
  SELECT answers INTO registration_answers
  FROM public.event_registrations
  WHERE id = NEW.registration_id;

  IF jsonb_typeof(registration_answers -> '__attendee_answers') = 'array'
     AND (registration_answers -> '__attendee_answers') -> NEW.sort_order IS NOT NULL THEN
    NEW.answers := (registration_answers -> '__attendee_answers') -> NEW.sort_order;
  ELSE
    NEW.answers := COALESCE(registration_answers, '{}'::jsonb);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS event_attendee_answers_sync ON public.event_registration_attendees;
CREATE TRIGGER event_attendee_answers_sync
  BEFORE INSERT OR UPDATE OF registration_id, sort_order
  ON public.event_registration_attendees
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_event_attendee_answers();

GRANT SELECT ON public.event_registration_attendees TO authenticated;
