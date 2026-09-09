-- ============================================================
-- Migration: Fix Accounting Tables (Missing Columns)
-- ============================================================

-- Ensure journal_entries has the required columns
CREATE TABLE IF NOT EXISTS public.journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_number TEXT UNIQUE NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    description TEXT,
    ref_type TEXT,
    debit_account TEXT,
    debit_amount DECIMAL(15,2),
    credit_account TEXT,
    credit_amount DECIMAL(15,2),
    created_by TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- If the table exists but is missing the 'date' column, add it
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='journal_entries' AND column_name='date') THEN
        ALTER TABLE public.journal_entries ADD COLUMN date DATE NOT NULL DEFAULT CURRENT_DATE;
    END IF;
END $$;

-- Ensure expenses has the required columns
CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    category TEXT,
    description TEXT,
    amount DECIMAL(15,2),
    status TEXT DEFAULT 'Pending'
);

-- If the table exists but is missing the 'date' column, add it
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='expenses' AND column_name='date') THEN
        ALTER TABLE public.expenses ADD COLUMN date DATE NOT NULL DEFAULT CURRENT_DATE;
    END IF;
END $$;

-- Enable RLS for these tables if not already enabled
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- Basic policies
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Enable all for all on journal_entries' AND tablename = 'journal_entries') THEN
        CREATE POLICY "Enable all for all on journal_entries" ON public.journal_entries FOR ALL USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Enable all for all on expenses' AND tablename = 'expenses') THEN
        CREATE POLICY "Enable all for all on expenses" ON public.expenses FOR ALL USING (true);
    END IF;
END
$$;
