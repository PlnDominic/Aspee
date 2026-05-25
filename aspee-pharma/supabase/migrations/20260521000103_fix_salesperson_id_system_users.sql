-- Fix salesperson_id foreign keys to reference system_users instead of profiles.
-- Applies to: customers, requisitions (and any other tables with this constraint).

DO $$
BEGIN
    -- Fix customers: salesperson_id
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'customers'
    ) THEN
        ALTER TABLE public.customers
            DROP CONSTRAINT IF EXISTS customers_salesperson_id_fkey;

        IF EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name = 'profiles'
        ) THEN
            UPDATE public.customers c
            SET salesperson_id = su.id
            FROM public.profiles p
            JOIN public.system_users su
              ON lower(su.email) = lower(p.email)
            WHERE c.salesperson_id = p.id
              AND c.salesperson_id IS DISTINCT FROM su.id;
        END IF;

        UPDATE public.customers c
        SET salesperson_id = NULL
        WHERE salesperson_id IS NOT NULL
          AND NOT EXISTS (
              SELECT 1
              FROM public.system_users su
              WHERE su.id = c.salesperson_id
          );

        ALTER TABLE public.customers
            ADD CONSTRAINT customers_salesperson_id_fkey
            FOREIGN KEY (salesperson_id)
            REFERENCES public.system_users(id)
            ON DELETE SET NULL;
    END IF;

    -- Fix requisitions: salesperson_id (in case not already done)
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'requisitions'
    ) THEN
        -- Only if the constraint still references profiles
        IF EXISTS (
            SELECT 1
            FROM pg_constraint c
            JOIN pg_class t ON c.conrelid = t.oid
            JOIN information_schema.constraint_column_usage ccu
              ON ccu.table_name = t.relname
              AND ccu.column_name = 'salesperson_id'
            WHERE t.relname = 'requisitions'
              AND c.conname = 'requisitions_salesperson_id_fkey'
              AND c.confrelid = (SELECT oid FROM pg_class WHERE relname = 'profiles')
        ) THEN
            ALTER TABLE public.requisitions
                DROP CONSTRAINT IF EXISTS requisitions_salesperson_id_fkey;

            IF EXISTS (
                SELECT 1
                FROM information_schema.tables
                WHERE table_schema = 'public'
                  AND table_name = 'profiles'
            ) THEN
                UPDATE public.requisitions r
                SET salesperson_id = su.id
                FROM public.profiles p
                JOIN public.system_users su
                  ON lower(su.email) = lower(p.email)
                WHERE r.salesperson_id = p.id
                  AND r.salesperson_id IS DISTINCT FROM su.id;
            END IF;

            UPDATE public.requisitions r
            SET salesperson_id = NULL
            WHERE salesperson_id IS NOT NULL
              AND NOT EXISTS (
                  SELECT 1
                  FROM public.system_users su
                  WHERE su.id = r.salesperson_id
              );

            ALTER TABLE public.requisitions
                ADD CONSTRAINT requisitions_salesperson_id_fkey
                FOREIGN KEY (salesperson_id)
                REFERENCES public.system_users(id)
                ON DELETE RESTRICT;
        END IF;
    END IF;
END $$;
