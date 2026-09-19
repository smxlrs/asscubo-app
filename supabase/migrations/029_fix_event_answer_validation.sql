-- Avoid a PL/pgSQL name collision between a local variable and the
-- jsonb_array_elements result column while validating registration answers.

CREATE OR REPLACE FUNCTION public.validate_event_registration_answers(
  p_event_id UUID,
  p_answers JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  field JSONB;
  field_key TEXT;
  field_type TEXT;
  answer_value JSONB;
BEGIN
  IF p_answers IS NULL OR jsonb_typeof(p_answers) <> 'object' THEN
    RAISE EXCEPTION 'Registration answers must be an object.';
  END IF;

  FOR field IN
    SELECT form_field.value
    FROM jsonb_array_elements(
      COALESCE((SELECT registration_form FROM public.events WHERE id = p_event_id), '[]'::jsonb)
    ) AS form_field(value)
  LOOP
    field_key := NULLIF(field ->> 'key', '');
    field_type := COALESCE(field ->> 'type', 'text');
    IF field_key IS NULL OR (field ->> 'system') = 'true' THEN
      CONTINUE;
    END IF;

    answer_value := p_answers -> field_key;

    IF (field ->> 'required') = 'true' AND (
      answer_value IS NULL
      OR answer_value = 'null'::jsonb
      OR (jsonb_typeof(answer_value) = 'string' AND btrim(answer_value #>> '{}') = '')
      OR (jsonb_typeof(answer_value) = 'array' AND jsonb_array_length(answer_value) = 0)
      OR (field_type = 'checkbox' AND answer_value = 'false'::jsonb)
    ) THEN
      RAISE EXCEPTION 'Required registration field is missing: %', field_key;
    END IF;

    IF answer_value IS NOT NULL AND answer_value <> 'null'::jsonb AND field_type = 'email'
       AND NOT ((answer_value #>> '{}') ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$') THEN
      RAISE EXCEPTION 'Invalid email value for field: %', field_key;
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_event_registration_answers(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_event_registration_answers(UUID, JSONB) TO authenticated;
