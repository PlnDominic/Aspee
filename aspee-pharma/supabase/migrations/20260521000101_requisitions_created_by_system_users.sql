-- Fix requisitions created_by foreign key to reference system_users instead of profiles.
-- Migrates existing created_by values to point to system_users IDs.

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'requisitions'
    ) THEN
        ALTER TABLE public.requisitions
            DROP CONSTRAINT IF EXISTS requisitions_created_by_fkey;

        -- Migrate existing created_by values from profiles to system_users
        IF EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name = 'profiles'
        ) THEN
            UPDATE public.requisitions r
            SET created_by = su.id
            FROM public.profiles p
            JOIN public.system_users su
              ON lower(su.email) = lower(p.email)
            WHERE r.created_by = p.id
              AND r.created_by IS DISTINCT FROM su.id;
        END IF;

        -- Clear orphaned created_by values that don't exist in system_users
        UPDATE public.requisitions r
        SET created_by = NULL
        WHERE created_by IS NOT NULL
          AND NOT EXISTS (
              SELECT 1
              FROM public.system_users su
              WHERE su.id = r.created_by
          );

        -- Add the new constraint
        ALTER TABLE public.requisitions
            ADD CONSTRAINT requisitions_created_by_fkey
            FOREIGN KEY (created_by)
            REFERENCES public.system_users(id)
            ON DELETE SET NULL;
    END IF;
END $$;
