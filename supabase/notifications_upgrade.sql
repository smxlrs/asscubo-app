-- ============================================================
-- SQL UPGRADE SCRIPT: Notifications Category Nullability & Storage Policies
-- Execute this script in your Supabase SQL Editor (https://supabase.com/dashboard/project/avxzgaozbfeqttmhmlld/sql)
-- ============================================================

-- 1. Make notifications.category nullable
ALTER TABLE public.notifications ALTER COLUMN category DROP NOT NULL;

-- 2. Drop existing check constraints on category column
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

-- 3. Re-add check constraint supporting NULL
ALTER TABLE public.notifications ADD CONSTRAINT notifications_category_check 
  CHECK (category IS NULL OR category IN ('events', 'academic', 'life', 'general'));

-- 4. Enable public read access to storage covers bucket
CREATE POLICY "Allow public select from covers" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'covers');

-- 5. Allow authenticated users to upload files to storage covers bucket
CREATE POLICY "Allow authenticated upload to covers" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'covers');

-- 6. Allow authenticated users to delete files from storage covers bucket
CREATE POLICY "Allow authenticated delete from covers" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'covers');
