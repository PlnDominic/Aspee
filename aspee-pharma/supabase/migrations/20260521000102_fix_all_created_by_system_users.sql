-- Fix sales_invoices and payment_receipts created_by to reference system_users instead of profiles.
-- Also update salesperson_id foreign keys for consistency.
-- Uses dynamic SQL (EXECUTE) to prevent compile-time failures on drifted databases.

DO $$
BEGIN
    -- Fix sales_invoices: created_by and salesperson_id
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'sales_invoices'
    ) THEN
        -- Drop old constraints
        EXECUTE 'ALTER TABLE public.sales_invoices DROP CONSTRAINT IF EXISTS sales_invoices_created_by_fkey';
        EXECUTE 'ALTER TABLE public.sales_invoices DROP CONSTRAINT IF EXISTS sales_invoices_salesperson_id_fkey';

        -- Migrate created_by from profiles to system_users (only if column exists)
        IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'sales_invoices'
              AND column_name = 'created_by'
        ) THEN
            IF EXISTS (
                SELECT 1
                FROM information_schema.tables
                WHERE table_schema = 'public'
                  AND table_name = 'profiles'
            ) THEN
                EXECUTE 'UPDATE public.sales_invoices si
                SET created_by = su.id
                FROM public.profiles p
                JOIN public.system_users su
                  ON lower(su.email) = lower(p.email)
                WHERE si.created_by = p.id
                  AND si.created_by IS DISTINCT FROM su.id';
            END IF;

            EXECUTE 'UPDATE public.sales_invoices si
            SET created_by = NULL
            WHERE created_by IS NOT NULL
              AND NOT EXISTS (
                  SELECT 1
                  FROM public.system_users su
                  WHERE su.id = si.created_by
              )';

            EXECUTE 'ALTER TABLE public.sales_invoices
                ADD CONSTRAINT sales_invoices_created_by_fkey
                FOREIGN KEY (created_by)
                REFERENCES public.system_users(id)
                ON DELETE SET NULL';
        END IF;

        -- Migrate salesperson_id from profiles to system_users (only if column exists)
        IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'sales_invoices'
              AND column_name = 'salesperson_id'
        ) THEN
            IF EXISTS (
                SELECT 1
                FROM information_schema.tables
                WHERE table_schema = 'public'
                  AND table_name = 'profiles'
            ) THEN
                EXECUTE 'UPDATE public.sales_invoices si
                SET salesperson_id = su.id
                FROM public.profiles p
                JOIN public.system_users su
                  ON lower(su.email) = lower(p.email)
                WHERE si.salesperson_id = p.id
                  AND si.salesperson_id IS DISTINCT FROM su.id';
            END IF;

            EXECUTE 'UPDATE public.sales_invoices si
            SET salesperson_id = NULL
            WHERE salesperson_id IS NOT NULL
              AND NOT EXISTS (
                  SELECT 1
                  FROM public.system_users su
                  WHERE su.id = si.salesperson_id
              )';

            EXECUTE 'ALTER TABLE public.sales_invoices
                ADD CONSTRAINT sales_invoices_salesperson_id_fkey
                FOREIGN KEY (salesperson_id)
                REFERENCES public.system_users(id)
                ON DELETE SET NULL';
        END IF;
    END IF;

    -- Fix payment_receipts: created_by
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'payment_receipts'
          AND column_name = 'created_by'
    ) THEN
        EXECUTE 'ALTER TABLE public.payment_receipts DROP CONSTRAINT IF EXISTS payment_receipts_created_by_fkey';

        IF EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name = 'profiles'
        ) THEN
            EXECUTE 'UPDATE public.payment_receipts pr
            SET created_by = su.id
            FROM public.profiles p
            JOIN public.system_users su
              ON lower(su.email) = lower(p.email)
            WHERE pr.created_by = p.id
              AND pr.created_by IS DISTINCT FROM su.id';
        END IF;

        EXECUTE 'UPDATE public.payment_receipts pr
        SET created_by = NULL
        WHERE created_by IS NOT NULL
          AND NOT EXISTS (
              SELECT 1
              FROM public.system_users su
              WHERE su.id = pr.created_by
          )';

        EXECUTE 'ALTER TABLE public.payment_receipts
            ADD CONSTRAINT payment_receipts_created_by_fkey
            FOREIGN KEY (created_by)
            REFERENCES public.system_users(id)
            ON DELETE SET NULL';
    END IF;

    -- Fix stock_movements: created_by
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'stock_movements'
          AND column_name = 'created_by'
    ) THEN
        EXECUTE 'ALTER TABLE public.stock_movements DROP CONSTRAINT IF EXISTS stock_movements_created_by_fkey';

        IF EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name = 'profiles'
        ) THEN
            EXECUTE 'UPDATE public.stock_movements sm
            SET created_by = su.id
            FROM public.profiles p
            JOIN public.system_users su
              ON lower(su.email) = lower(p.email)
            WHERE sm.created_by = p.id
              AND sm.created_by IS DISTINCT FROM su.id';
        END IF;

        EXECUTE 'UPDATE public.stock_movements sm
        SET created_by = NULL
        WHERE created_by IS NOT NULL
          AND NOT EXISTS (
              SELECT 1
              FROM public.system_users su
              WHERE su.id = sm.created_by
          )';

        EXECUTE 'ALTER TABLE public.stock_movements
            ADD CONSTRAINT stock_movements_created_by_fkey
            FOREIGN KEY (created_by)
            REFERENCES public.system_users(id)
            ON DELETE SET NULL';
    END IF;

    -- Fix stock_transfers: created_by
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'stock_transfers'
          AND column_name = 'created_by'
    ) THEN
        EXECUTE 'ALTER TABLE public.stock_transfers DROP CONSTRAINT IF EXISTS stock_transfers_created_by_fkey';

        IF EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name = 'profiles'
        ) THEN
            EXECUTE 'UPDATE public.stock_transfers st
            SET created_by = su.id
            FROM public.profiles p
            JOIN public.system_users su
              ON lower(su.email) = lower(p.email)
            WHERE st.created_by = p.id
              AND st.created_by IS DISTINCT FROM su.id';
        END IF;

        EXECUTE 'UPDATE public.stock_transfers st
        SET created_by = NULL
        WHERE created_by IS NOT NULL
          AND NOT EXISTS (
              SELECT 1
              FROM public.system_users su
              WHERE su.id = st.created_by
          )';

        EXECUTE 'ALTER TABLE public.stock_transfers
            ADD CONSTRAINT stock_transfers_created_by_fkey
            FOREIGN KEY (created_by)
            REFERENCES public.system_users(id)
            ON DELETE SET NULL';
    END IF;
END $$;
