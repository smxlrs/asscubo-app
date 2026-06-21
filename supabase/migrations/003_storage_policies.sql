-- Allow authenticated users (like admin logged into the App) to upload files to covers bucket
CREATE POLICY "Allow authenticated upload to covers" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'covers');

-- Allow anyone to view files in covers bucket
CREATE POLICY "Allow public select from covers" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'covers');
