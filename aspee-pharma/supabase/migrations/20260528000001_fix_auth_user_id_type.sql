-- Fix: system_users.auth_user_id was stored as text in production.
-- This restores the correct uuid type so all transactional functions that
-- compare auth_user_id = auth_user_uuid (uuid parameter) work without an
-- explicit cast. The audit trail functions already use ::text casts and
-- remain safe either way.

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'system_users'
          AND column_name  = 'auth_user_id'
          AND data_type    = 'text'
    ) THEN
        -- Nullify any value that is not a valid UUID to prevent the USING cast
        -- from raising an exception on bad data.
        UPDATE public.system_users
        SET auth_user_id = NULL
        WHERE auth_user_id IS NOT NULL
          AND auth_user_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

        ALTER TABLE public.system_users
            ALTER COLUMN auth_user_id TYPE uuid USING auth_user_id::uuid;
    END IF;
END $$;
