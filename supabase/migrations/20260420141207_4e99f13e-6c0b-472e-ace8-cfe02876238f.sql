CREATE POLICY "Admins can upload to meditations bucket"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'meditations' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update meditations bucket"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'meditations' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete from meditations bucket"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'meditations' AND public.has_role(auth.uid(), 'admin'));