-- CONSOLIDATED DATABASE MIGRATION & FIX
-- Migrates salesperson_id and created_by foreign keys from the legacy 'profiles' table to 'system_users'.
-- Also sets up clean RLS policies for requisitions and requisition_items.
-- Fully uses dynamic SQL (EXECUTE) to prevent compile-time failures on drifted databases.

DO $$
BEGIN
    -- =========================================================================
    -- 1. FIX REQUISITIONS: salesperson_id
    -- =========================================================================
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'requisitions'
    ) THEN
        EXECUTE 'ALTER TABLE public.requisitions DROP CONSTRAINT IF EXISTS requisitions_salesperson_id_fkey';

        IF EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'profiles'
        ) THEN
            EXECUTE 'UPDATE public.requisitions r
            SET salesperson_id = su.id
            FROM public.profiles p
            JOIN public.system_users su ON lower(su.email) = lower(p.email)
            WHERE r.salesperson_id = p.id
              AND r.salesperson_id IS DISTINCT FROM su.id';
        END IF;

        EXECUTE 'UPDATE public.requisitions r
        SET salesperson_id = NULL
        WHERE salesperson_id IS NOT NULL
          AND NOT EXISTS (
              SELECT 1 FROM public.system_users su WHERE su.id = r.salesperson_id
          )';

        EXECUTE 'ALTER TABLE public.requisitions
            ADD CONSTRAINT requisitions_salesperson_id_fkey
            FOREIGN KEY (salesperson_id)
            REFERENCES public.system_users(id)
            ON DELETE RESTRICT';
    END IF;

    -- =========================================================================
    -- 2. FIX REQUISITIONS: created_by
    -- =========================================================================
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'requisitions'
    ) THEN
        EXECUTE 'ALTER TABLE public.requisitions DROP CONSTRAINT IF EXISTS requisitions_created_by_fkey';

        IF EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'profiles'
        ) THEN
            EXECUTE 'UPDATE public.requisitions r
            SET created_by = su.id
            FROM public.profiles p
            JOIN public.system_users su ON lower(su.email) = lower(p.email)
            WHERE r.created_by = p.id
              AND r.created_by IS DISTINCT FROM su.id';
        END IF;

        EXECUTE 'UPDATE public.requisitions r
        SET created_by = NULL
        WHERE created_by IS NOT NULL
          AND NOT EXISTS (
              SELECT 1 FROM public.system_users su WHERE su.id = r.created_by
          )';

        EXECUTE 'ALTER TABLE public.requisitions
            ADD CONSTRAINT requisitions_created_by_fkey
            FOREIGN KEY (created_by)
            REFERENCES public.system_users(id)
            ON DELETE SET NULL';
    END IF;

    -- =========================================================================
    -- 3. FIX CUSTOMERS: salesperson_id
    -- =========================================================================
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'customers'
    ) THEN
        EXECUTE 'ALTER TABLE public.customers DROP CONSTRAINT IF EXISTS customers_salesperson_id_fkey';

        IF EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'profiles'
        ) THEN
            EXECUTE 'UPDATE public.customers c
            SET salesperson_id = su.id
            FROM public.profiles p
            JOIN public.system_users su ON lower(su.email) = lower(p.email)
            WHERE c.salesperson_id = p.id
              AND c.salesperson_id IS DISTINCT FROM su.id';
        END IF;

        EXECUTE 'UPDATE public.customers c
        SET salesperson_id = NULL
        WHERE salesperson_id IS NOT NULL
          AND NOT EXISTS (
              SELECT 1 FROM public.system_users su WHERE su.id = c.salesperson_id
          )';

        EXECUTE 'ALTER TABLE public.customers
            ADD CONSTRAINT customers_salesperson_id_fkey
            FOREIGN KEY (salesperson_id)
            REFERENCES public.system_users(id)
            ON DELETE SET NULL';
    END IF;

    -- =========================================================================
    -- 4. FIX SALES_INVOICES: created_by and salesperson_id
    -- =========================================================================
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'sales_invoices'
    ) THEN
        EXECUTE 'ALTER TABLE public.sales_invoices DROP CONSTRAINT IF EXISTS sales_invoices_created_by_fkey';
        EXECUTE 'ALTER TABLE public.sales_invoices DROP CONSTRAINT IF EXISTS sales_invoices_salesperson_id_fkey';

        -- created_by column
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'sales_invoices' AND column_name = 'created_by'
        ) THEN
            IF EXISTS (
                SELECT 1 FROM information_schema.tables 
                WHERE table_schema = 'public' AND table_name = 'profiles'
            ) THEN
                EXECUTE 'UPDATE public.sales_invoices si
                SET created_by = su.id
                FROM public.profiles p
                JOIN public.system_users su ON lower(su.email) = lower(p.email)
                WHERE si.created_by = p.id
                  AND si.created_by IS DISTINCT FROM su.id';
            END IF;

            EXECUTE 'UPDATE public.sales_invoices si
            SET created_by = NULL
            WHERE created_by IS NOT NULL
              AND NOT EXISTS (
                  SELECT 1 FROM public.system_users su WHERE su.id = si.created_by
              )';

            EXECUTE 'ALTER TABLE public.sales_invoices
                ADD CONSTRAINT sales_invoices_created_by_fkey
                FOREIGN KEY (created_by)
                REFERENCES public.system_users(id)
                ON DELETE SET NULL';
        END IF;

        -- salesperson_id column
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'sales_invoices' AND column_name = 'salesperson_id'
        ) THEN
            IF EXISTS (
                SELECT 1 FROM information_schema.tables 
                WHERE table_schema = 'public' AND table_name = 'profiles'
            ) THEN
                EXECUTE 'UPDATE public.sales_invoices si
                SET salesperson_id = su.id
                FROM public.profiles p
                JOIN public.system_users su ON lower(su.email) = lower(p.email)
                WHERE si.salesperson_id = p.id
                  AND si.salesperson_id IS DISTINCT FROM su.id';
            END IF;

            EXECUTE 'UPDATE public.sales_invoices si
            SET salesperson_id = NULL
            WHERE salesperson_id IS NOT NULL
              AND NOT EXISTS (
                  SELECT 1 FROM public.system_users su WHERE su.id = si.salesperson_id
              )';

            EXECUTE 'ALTER TABLE public.sales_invoices
                ADD CONSTRAINT sales_invoices_salesperson_id_fkey
                FOREIGN KEY (salesperson_id)
                REFERENCES public.system_users(id)
                ON DELETE SET NULL';
        END IF;
    END IF;

    -- =========================================================================
    -- 5. FIX PAYMENT_RECEIPTS: created_by
    -- =========================================================================
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'payment_receipts' AND column_name = 'created_by'
    ) THEN
        EXECUTE 'ALTER TABLE public.payment_receipts DROP CONSTRAINT IF EXISTS payment_receipts_created_by_fkey';

        IF EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'profiles'
        ) THEN
            EXECUTE 'UPDATE public.payment_receipts pr
            SET created_by = su.id
            FROM public.profiles p
            JOIN public.system_users su ON lower(su.email) = lower(p.email)
            WHERE pr.created_by = p.id
              AND pr.created_by IS DISTINCT FROM su.id';
        END IF;

        EXECUTE 'UPDATE public.payment_receipts pr
        SET created_by = NULL
        WHERE created_by IS NOT NULL
          AND NOT EXISTS (
              SELECT 1 FROM public.system_users su WHERE su.id = pr.created_by
          )';

        EXECUTE 'ALTER TABLE public.payment_receipts
            ADD CONSTRAINT payment_receipts_created_by_fkey
            FOREIGN KEY (created_by)
            REFERENCES public.system_users(id)
            ON DELETE SET NULL';
    END IF;

    -- =========================================================================
    -- 6. FIX STOCK_MOVEMENTS: created_by
    -- =========================================================================
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'stock_movements' AND column_name = 'created_by'
    ) THEN
        EXECUTE 'ALTER TABLE public.stock_movements DROP CONSTRAINT IF EXISTS stock_movements_created_by_fkey';

        IF EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'profiles'
        ) THEN
            EXECUTE 'UPDATE public.stock_movements sm
            SET created_by = su.id
            FROM public.profiles p
            JOIN public.system_users su ON lower(su.email) = lower(p.email)
            WHERE sm.created_by = p.id
              AND sm.created_by IS DISTINCT FROM su.id';
        END IF;

        EXECUTE 'UPDATE public.stock_movements sm
        SET created_by = NULL
        WHERE created_by IS NOT NULL
          AND NOT EXISTS (
              SELECT 1 FROM public.system_users su WHERE su.id = sm.created_by
          )';

        EXECUTE 'ALTER TABLE public.stock_movements
            ADD CONSTRAINT stock_movements_created_by_fkey
            FOREIGN KEY (created_by)
            REFERENCES public.system_users(id)
            ON DELETE SET NULL';
    END IF;

    -- =========================================================================
    -- 7. FIX STOCK_TRANSFERS: created_by
    -- =========================================================================
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'stock_transfers' AND column_name = 'created_by'
    ) THEN
        EXECUTE 'ALTER TABLE public.stock_transfers DROP CONSTRAINT IF EXISTS stock_transfers_created_by_fkey';

        IF EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'profiles'
        ) THEN
            EXECUTE 'UPDATE public.stock_transfers st
            SET created_by = su.id
            FROM public.profiles p
            JOIN public.system_users su ON lower(su.email) = lower(p.email)
            WHERE st.created_by = p.id
              AND st.created_by IS DISTINCT FROM su.id';
        END IF;

        EXECUTE 'UPDATE public.stock_transfers st
        SET created_by = NULL
        WHERE created_by IS NOT NULL
          AND NOT EXISTS (
              SELECT 1 FROM public.system_users su WHERE su.id = st.created_by
          )';

        EXECUTE 'ALTER TABLE public.stock_transfers
            ADD CONSTRAINT stock_transfers_created_by_fkey
            FOREIGN KEY (created_by)
            REFERENCES public.system_users(id)
            ON DELETE SET NULL';
    END IF;

    -- =========================================================================
    -- 8. ENABLE RLS AND CONFIGURE POLICIES FOR REQUISITIONS
    -- =========================================================================
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'requisitions'
    ) THEN
        -- Drop legacy policy if it exists
        EXECUTE 'DROP POLICY IF EXISTS "Salespersons can manage their requisitions" ON public.requisitions';

        -- Enable RLS
        EXECUTE 'ALTER TABLE public.requisitions ENABLE ROW LEVEL SECURITY';

        -- Requisitions select policy
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE tablename = 'requisitions' AND policyname = 'Allow authenticated select on requisitions'
        ) THEN
            EXECUTE 'CREATE POLICY "Allow authenticated select on requisitions" ON public.requisitions 
                FOR SELECT TO authenticated USING (true)';
        END IF;

        -- Requisitions insert policy
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE tablename = 'requisitions' AND policyname = 'Allow authenticated insert on requisitions'
        ) THEN
            EXECUTE 'CREATE POLICY "Allow authenticated insert on requisitions" ON public.requisitions 
                FOR INSERT TO authenticated WITH CHECK (true)';
        END IF;

        -- Requisitions update policy
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE tablename = 'requisitions' AND policyname = 'Allow authenticated update on requisitions'
        ) THEN
            EXECUTE 'CREATE POLICY "Allow authenticated update on requisitions" ON public.requisitions 
                FOR UPDATE TO authenticated USING (true) WITH CHECK (true)';
        END IF;

        -- Requisitions delete policy
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE tablename = 'requisitions' AND policyname = 'Allow authenticated delete on requisitions'
        ) THEN
            EXECUTE 'CREATE POLICY "Allow authenticated delete on requisitions" ON public.requisitions 
                FOR DELETE TO authenticated USING (true)';
        END IF;
    END IF;

    -- =========================================================================
    -- 9. ENABLE RLS AND CONFIGURE POLICIES FOR REQUISITION_ITEMS
    -- =========================================================================
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'requisition_items'
    ) THEN
        -- Enable RLS
        EXECUTE 'ALTER TABLE public.requisition_items ENABLE ROW LEVEL SECURITY';

        -- Requisition items select policy
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE tablename = 'requisition_items' AND policyname = 'Allow authenticated select on requisition_items'
        ) THEN
            EXECUTE 'CREATE POLICY "Allow authenticated select on requisition_items" ON public.requisition_items 
                FOR SELECT TO authenticated USING (true)';
        END IF;

        -- Requisition items insert policy
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE tablename = 'requisition_items' AND policyname = 'Allow authenticated insert on requisition_items'
        ) THEN
            EXECUTE 'CREATE POLICY "Allow authenticated insert on requisition_items" ON public.requisition_items 
                FOR INSERT TO authenticated WITH CHECK (true)';
        END IF;

        -- Requisition items update policy
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE tablename = 'requisition_items' AND policyname = 'Allow authenticated update on requisition_items'
        ) THEN
            EXECUTE 'CREATE POLICY "Allow authenticated update on requisition_items" ON public.requisition_items 
                FOR UPDATE TO authenticated USING (true) WITH CHECK (true)';
        END IF;

        -- Requisition items delete policy
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE tablename = 'requisition_items' AND policyname = 'Allow authenticated delete on requisition_items'
        ) THEN
            EXECUTE 'CREATE POLICY "Allow authenticated delete on requisition_items" ON public.requisition_items 
                FOR DELETE TO authenticated USING (true)';
        END IF;
    END IF;

    -- =========================================================================
    -- 10. REFRESH SCHEMA CACHE FOR POSTGREST
    -- =========================================================================
    -- Notify PostgREST to reload schema
    NOTIFY pgrst, 'reload schema';

END $$;
