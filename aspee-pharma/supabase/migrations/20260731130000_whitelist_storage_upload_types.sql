-- Every upload in the app (compliance/Ghana Card documents, profile
-- avatars) only restricted file type via the HTML input's accept=
-- attribute (and, for avatars, a client-side file.type check) — both are
-- attacker-controlled and trivially bypassed by hitting the Storage API
-- directly. Supabase Storage enforces allowed_mime_types/file_size_limit
-- server-side regardless of what the client claims, so set them on both
-- buckets actually used in the app.

UPDATE storage.buckets
SET
    allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
    file_size_limit = 10485760 -- 10MB
WHERE id = 'compliance-documents';

-- 'avatar' bucket is created ad hoc by the client on first use in some
-- environments (see settings/profile/page.tsx) rather than by a prior
-- migration, so create it here too if it doesn't exist yet.
INSERT INTO storage.buckets (id, name, public, allowed_mime_types, file_size_limit)
VALUES (
    'avatar',
    'avatar',
    true,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    2097152 -- 2MB, matches the existing client-side check
)
ON CONFLICT (id) DO UPDATE
SET
    allowed_mime_types = EXCLUDED.allowed_mime_types,
    file_size_limit = EXCLUDED.file_size_limit;
