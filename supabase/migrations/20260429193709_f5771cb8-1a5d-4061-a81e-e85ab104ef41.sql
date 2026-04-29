
-- Block bucket listing while still allowing public reads via direct object URL.
-- Lovable/Supabase exposes public buckets through the /object/public/... CDN
-- which doesn't require the SELECT policy on storage.objects, so revoking
-- broad SELECT here only stops the LIST operation that scanners flag.
DROP POLICY IF EXISTS "Anyone can read meditation audio" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view meditation artwork" ON storage.objects;

-- Owners (and admins) can still read their own files via authenticated SELECT
CREATE POLICY "Users read own meditation audio"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'meditations'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Admins read all meditation audio"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'meditations'
    AND public.has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Users read own meditation artwork"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'meditation-artwork'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Admins read all meditation artwork"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'meditation-artwork'
    AND public.has_role(auth.uid(), 'admin'::app_role)
  );
