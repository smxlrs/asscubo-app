-- Submit one self registration plus one independent proxy registration for
-- each additional person. Calling the existing atomic registration function
-- keeps capacity, waitlist, and vehicle rules identical for every person.

CREATE OR REPLACE FUNCTION public.submit_event_registration_group(
  p_event_id UUID,
  p_participants JSONB,
  p_source TEXT DEFAULT 'app'
)
RETURNS TABLE (
  participant_index INTEGER,
  registration_id UUID,
  registration_status TEXT,
  assigned_vehicle_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  participant JSONB;
  participant_ordinality BIGINT;
  participant_name TEXT;
  participant_note TEXT;
  participant_vehicle_id UUID;
  created_registration_id UUID;
  created_status TEXT;
  created_vehicle_id UUID;
  created_count INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to register.';
  END IF;
  IF jsonb_typeof(COALESCE(p_participants, 'null'::jsonb)) <> 'array'
     OR jsonb_array_length(p_participants) < 2
     OR jsonb_array_length(p_participants) > 100 THEN
    RAISE EXCEPTION 'Group registration must contain between 2 and 100 people.';
  END IF;

  FOR participant, participant_ordinality IN
    SELECT participant_item.value, participant_item.ordinality
    FROM jsonb_array_elements(p_participants)
      WITH ORDINALITY AS participant_item(value, ordinality)
  LOOP
    participant_name := NULLIF(btrim(COALESCE(participant ->> 'name', '')), '');
    participant_note := NULLIF(btrim(COALESCE(participant ->> 'proxy_note', '')), '');
    participant_vehicle_id := NULLIF(participant ->> 'vehicle_id', '')::UUID;

    IF participant_name IS NULL THEN
      RAISE EXCEPTION 'Each participant needs a name.';
    END IF;
    IF participant_ordinality > 1 AND participant_note IS NULL THEN
      RAISE EXCEPTION 'Each additional participant needs a proxy note.';
    END IF;

    SELECT result.registration_id, result.registration_status,
           result.assigned_vehicle_id, result.participant_count
    INTO created_registration_id, created_status, created_vehicle_id, created_count
    FROM public.submit_event_registration(
      p_event_id,
      CASE WHEN participant_ordinality = 1 THEN 'self' ELSE 'proxy' END,
      CASE WHEN participant_ordinality = 1 THEN NULL ELSE participant_note END,
      1,
      COALESCE(participant -> 'answers', '{}'::jsonb),
      jsonb_build_array(jsonb_build_object(
        'name', participant_name,
        'phone', participant ->> 'phone',
        'email', participant ->> 'email',
        'answers', COALESCE(participant -> 'answers', '{}'::jsonb)
      )),
      participant_vehicle_id,
      COALESCE(NULLIF(p_source, ''), 'app')
    ) AS result;

    RETURN QUERY SELECT participant_ordinality::INTEGER,
      created_registration_id, created_status, created_vehicle_id;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_event_registration_group(UUID, JSONB, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_event_registration_group(UUID, JSONB, TEXT) TO authenticated;
