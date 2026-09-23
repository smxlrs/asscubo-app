-- Allow students from Accademia di Belle Arti di Bologna to register.
INSERT INTO public.allowed_signup_domains (domain, institution_name, enabled)
VALUES ('ababo.it', '博洛尼亚美术学院', TRUE)
ON CONFLICT (domain) DO UPDATE
SET institution_name = EXCLUDED.institution_name,
    enabled = EXCLUDED.enabled;
