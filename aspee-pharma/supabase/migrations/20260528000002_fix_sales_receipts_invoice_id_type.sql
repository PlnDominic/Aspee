-- Normalize sales_receipts.invoice_id so receipt posting can compare it to
-- sales_invoices.id without text = uuid operator errors.

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'sales_receipts'
          AND column_name = 'invoice_id'
          AND data_type <> 'uuid'
    ) THEN
        ALTER TABLE public.sales_receipts
            DROP CONSTRAINT IF EXISTS sales_receipts_invoice_id_fkey;

        ALTER TABLE public.sales_receipts
            ALTER COLUMN invoice_id TYPE uuid
            USING CASE
                WHEN invoice_id IS NULL OR btrim(invoice_id::text) = '' THEN NULL
                WHEN invoice_id::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                    THEN invoice_id::text::uuid
                ELSE NULL
            END;

        UPDATE public.sales_receipts sr
        SET invoice_id = NULL
        WHERE sr.invoice_id IS NOT NULL
          AND NOT EXISTS (
              SELECT 1
              FROM public.sales_invoices si
              WHERE si.id = sr.invoice_id
          );

        ALTER TABLE public.sales_receipts
            ADD CONSTRAINT sales_receipts_invoice_id_fkey
            FOREIGN KEY (invoice_id)
            REFERENCES public.sales_invoices(id)
            ON DELETE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_sales_receipts_invoice_id
ON public.sales_receipts(invoice_id);

NOTIFY pgrst, 'reload schema';
