-- Allow authenticated users to manage files in compliance-documents bucket.
-- This fixes: "new row violates row-level security policy" during upload.

DO $$
BEGIN
    -- INSERT (upload)
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'storage'
          AND tablename = 'objects'
          AND policyname = 'compliance_documents_insert_authenticated'
    ) THEN
        CREATE POLICY compliance_documents_insert_authenticated
        ON storage.objects
        FOR INSERT
        TO authenticated
        WITH CHECK (bucket_id = 'compliance-documents');
    END IF;

    -- SELECT (read/signed URLs)
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'storage'
          AND tablename = 'objects'
          AND policyname = 'compliance_documents_select_authenticated'
    ) THEN
        CREATE POLICY compliance_documents_select_authenticated
        ON storage.objects
        FOR SELECT
        TO authenticated
        USING (bucket_id = 'compliance-documents');
    END IF;

    -- UPDATE (replace/upsert)
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'storage'
          AND tablename = 'objects'
          AND policyname = 'compliance_documents_update_authenticated'
    ) THEN
        CREATE POLICY compliance_documents_update_authenticated
        ON storage.objects
        FOR UPDATE
        TO authenticated
        USING (bucket_id = 'compliance-documents')
        WITH CHECK (bucket_id = 'compliance-documents');
    END IF;

    -- DELETE (remove old files)
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'storage'
          AND tablename = 'objects'
          AND policyname = 'compliance_documents_delete_authenticated'
    ) THEN
        CREATE POLICY compliance_documents_delete_authenticated
        ON storage.objects
        FOR DELETE
        TO authenticated
        USING (bucket_id = 'compliance-documents');
    END IF;
END $$;

