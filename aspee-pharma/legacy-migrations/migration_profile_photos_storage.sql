-- Create storage bucket for user avatars
-- Run this in Supabase SQL editor

-- Create the storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatar',
  'avatar',
  true,
  2097152, -- 2MB in bytes
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Set up RLS policies for the bucket
-- Allow authenticated users to upload their own avatars
CREATE POLICY "Allow users to upload own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatar' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to update their own avatars
CREATE POLICY "Allow users to update own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatar' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow public read access (since bucket is public)
CREATE POLICY "Allow public read access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatar');

-- Add photo_url column to system_users table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'system_users' AND column_name = 'photo_url'
  ) THEN
    ALTER TABLE system_users ADD COLUMN photo_url TEXT;
  END IF;
END $$;
