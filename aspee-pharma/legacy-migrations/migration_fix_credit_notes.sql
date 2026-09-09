-- Fix credit_notes table to match frontend expectations
-- Adds invoice_id FK, and ensures column names match what the app uses

-- 1. Add invoice_id column with FK to sales_invoices (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'credit_notes' AND column_name = 'invoice_id'
    ) THEN
        ALTER TABLE credit_notes ADD COLUMN invoice_id UUID REFERENCES sales_invoices(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 2. Add cn_number column (frontend uses this instead of credit_note_number)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'credit_notes' AND column_name = 'cn_number'
    ) THEN
        -- Add cn_number
        ALTER TABLE credit_notes ADD COLUMN cn_number TEXT;
        -- Copy existing data from credit_note_number if it exists
        UPDATE credit_notes SET cn_number = credit_note_number WHERE cn_number IS NULL AND credit_note_number IS NOT NULL;
    END IF;
END $$;

-- 3. Add amount column (frontend uses this instead of original_amount)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'credit_notes' AND column_name = 'amount'
    ) THEN
        ALTER TABLE credit_notes ADD COLUMN amount DECIMAL(15,2) DEFAULT 0;
        -- Copy existing data from original_amount if it exists
        UPDATE credit_notes SET amount = original_amount WHERE amount IS NULL OR amount = 0;
    END IF;
END $$;

-- 4. Add reason column (frontend expects this)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'credit_notes' AND column_name = 'reason'
    ) THEN
        ALTER TABLE credit_notes ADD COLUMN reason TEXT;
    END IF;
END $$;

-- 5. Ensure RLS policy exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Enable all for all on credit_notes') THEN
        CREATE POLICY "Enable all for all on credit_notes" ON credit_notes FOR ALL USING (true);
    END IF;
END $$;
