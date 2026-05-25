-- Add foreign key constraint on credit_notes.invoice_id -> sales_invoices.id
-- This allows PostgREST (Supabase) to resolve the join in embedded selects
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_type = 'FOREIGN KEY'
        AND table_name = 'credit_notes'
        AND constraint_name = 'credit_notes_invoice_id_fkey'
    ) THEN
        ALTER TABLE credit_notes
            ADD CONSTRAINT credit_notes_invoice_id_fkey
            FOREIGN KEY (invoice_id) REFERENCES sales_invoices(id) ON DELETE SET NULL;
    END IF;
END $$;
