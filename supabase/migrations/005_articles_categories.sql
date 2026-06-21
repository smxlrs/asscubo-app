-- 1. Drop existing check constraints on category column in articles table
DO $$
DECLARE
    r record;
BEGIN
    FOR r IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'public.articles'::regclass
          AND contype = 'c'
          AND conname LIKE '%category%'
    LOOP
        EXECUTE 'ALTER TABLE public.articles DROP CONSTRAINT ' || quote_ident(r.conname);
    END LOOP;
END $$;

-- 2. Add new check constraint allowing 'notice', 'news', 'event_news', 'general', 'column', 'reprint'
ALTER TABLE public.articles ADD CONSTRAINT articles_category_check 
  CHECK (category IN ('notice', 'news', 'event_news', 'general', 'column', 'reprint'));
