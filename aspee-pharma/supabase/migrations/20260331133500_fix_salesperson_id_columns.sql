-- Normalize legacy salesperson columns to salesperson_id.
-- This resolves queries/views that reference salesperson_id.

DO $$
BEGIN
    -- customers: normalize salesperson column naming
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'customers'
    ) THEN
        IF NOT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'salesperson_id'
        ) THEN
            IF EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'salesperson'
            ) THEN
                ALTER TABLE public.customers RENAME COLUMN salesperson TO salesperson_id;
            ELSIF EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'salespersonid'
            ) THEN
                ALTER TABLE public.customers RENAME COLUMN salespersonid TO salesperson_id;
            ELSE
                ALTER TABLE public.customers ADD COLUMN salesperson_id UUID;
            END IF;
        END IF;

        IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conname = 'customers_salesperson_id_fkey'
        ) THEN
            ALTER TABLE public.customers
            ADD CONSTRAINT customers_salesperson_id_fkey
            FOREIGN KEY (salesperson_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
        END IF;
    END IF;

    -- sales_invoices: normalize salesperson column naming
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'sales_invoices'
    ) THEN
        IF NOT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'sales_invoices' AND column_name = 'salesperson_id'
        ) THEN
            IF EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'sales_invoices' AND column_name = 'salesperson'
            ) THEN
                ALTER TABLE public.sales_invoices RENAME COLUMN salesperson TO salesperson_id;
            ELSIF EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'sales_invoices' AND column_name = 'salespersonid'
            ) THEN
                ALTER TABLE public.sales_invoices RENAME COLUMN salespersonid TO salesperson_id;
            ELSE
                ALTER TABLE public.sales_invoices ADD COLUMN salesperson_id UUID;
            END IF;
        END IF;

        IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conname = 'sales_invoices_salesperson_id_fkey'
        ) THEN
            ALTER TABLE public.sales_invoices
            ADD CONSTRAINT sales_invoices_salesperson_id_fkey
            FOREIGN KEY (salesperson_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
        END IF;

        CREATE INDEX IF NOT EXISTS idx_sales_invoices_salesperson_id ON public.sales_invoices(salesperson_id);
    END IF;
END $$;

