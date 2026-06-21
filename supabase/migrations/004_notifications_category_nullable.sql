-- 1. Make category column nullable in notifications table
ALTER TABLE public.notifications ALTER COLUMN category DROP NOT NULL;

-- 2. Drop existing auto-generated check constraints on category column
DO $$
DECLARE
    r record;
BEGIN
    FOR r IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'public.notifications'::regclass
          AND contype = 'c'
          AND conname LIKE '%category%'
    LOOP
        EXECUTE 'ALTER TABLE public.notifications DROP CONSTRAINT ' || quote_ident(r.conname);
    END LOOP;
END $$;

-- 3. Add new check constraint allowing NULL or one of the categories
ALTER TABLE public.notifications ADD CONSTRAINT notifications_category_check 
  CHECK (category IS NULL OR category IN ('events', 'academic', 'life', 'general'));
