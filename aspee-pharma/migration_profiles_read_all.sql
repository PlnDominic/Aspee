-- Allow any authenticated user to read basic profile info (name, role) from all profiles.
-- Required for dropdowns (salesperson selects, van assignment, etc.) that run client-side.
-- Write/delete permissions are unchanged — still owner or admin only.

DROP POLICY IF EXISTS "Authenticated users can read all profiles" ON public.profiles;

CREATE POLICY "Authenticated users can read all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);
