-- Normalize legacy customer columns to customer_id.
-- This resolves queries/views that reference customer_id.

DO $$
BEGIN
    -- sales_invoices: normalize customer column naming
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'sales_invoices'
    ) THEN
        IF NOT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'sales_invoices' AND column_name = 'customer_id'
        ) THEN
            IF EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'sales_invoices' AND column_name = 'customer'
            ) THEN
                ALTER TABLE public.sales_invoices RENAME COLUMN customer TO customer_id;
            ELSIF EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'sales_invoices' AND column_name = 'customerid'
            ) THEN
                ALTER TABLE public.sales_invoices RENAME COLUMN customerid TO customer_id;
            ELSE
                ALTER TABLE public.sales_invoices ADD COLUMN customer_id UUID;
            END IF;
        END IF;

        IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conname = 'sales_invoices_customer_id_fkey'
        ) THEN
            ALTER TABLE public.sales_invoices
            ADD CONSTRAINT sales_invoices_customer_id_fkey
            FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE RESTRICT;
        END IF;

        CREATE INDEX IF NOT EXISTS idx_sales_invoices_customer_id ON public.sales_invoices(customer_id);
    END IF;

    -- payment_receipts: normalize customer column naming
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'payment_receipts'
    ) THEN
        IF NOT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'payment_receipts' AND column_name = 'customer_id'
        ) THEN
            IF EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'payment_receipts' AND column_name = 'customer'
            ) THEN
                ALTER TABLE public.payment_receipts RENAME COLUMN customer TO customer_id;
            ELSIF EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'payment_receipts' AND column_name = 'customerid'
            ) THEN
                ALTER TABLE public.payment_receipts RENAME COLUMN customerid TO customer_id;
            ELSE
                ALTER TABLE public.payment_receipts ADD COLUMN customer_id UUID;
            END IF;
        END IF;

        IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conname = 'payment_receipts_customer_id_fkey'
        ) THEN
            ALTER TABLE public.payment_receipts
            ADD CONSTRAINT payment_receipts_customer_id_fkey
            FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE RESTRICT;
        END IF;

        CREATE INDEX IF NOT EXISTS idx_payment_receipts_customer_id ON public.payment_receipts(customer_id);
    END IF;
END $$;
