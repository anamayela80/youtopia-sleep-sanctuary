
-- 1. Lock down user_roles: no client INSERT/UPDATE/DELETE allowed.
-- Block all writes from authenticated and anon roles. Only service_role
-- (which bypasses RLS) can modify roles, and the existing handle_new_user
-- trigger function is SECURITY DEFINER so it still works on signup.
CREATE POLICY "No client inserts on user_roles"
  ON public.user_roles FOR INSERT
  TO authenticated, anon
  WITH CHECK (false);

CREATE POLICY "No client updates on user_roles"
  ON public.user_roles FOR UPDATE
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);

CREATE POLICY "No client deletes on user_roles"
  ON public.user_roles FOR DELETE
  TO authenticated, anon
  USING (false);

-- 2. Tighten meditation-artwork bucket: only allow uploads under the
-- caller's own user-id folder (mirrors meditations bucket policy).
DROP POLICY IF EXISTS "Authenticated can upload meditation artwork" ON storage.objects;

CREATE POLICY "Users can upload artwork to own folder"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'meditation-artwork'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

-- 3. Revoke EXECUTE on SECURITY DEFINER helper functions from public roles.
-- has_role is called inside RLS policies (which run with elevated context)
-- so revoking EXECUTE from anon/authenticated does not break policy checks.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
