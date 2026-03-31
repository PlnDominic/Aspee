-- ============================================================
-- FINAL CONSOLIDATED FINANCIAL SETUP SCRIPT
-- This version handles missing columns and ensures a clean state
-- ============================================================

-- 1. Setup Chart of Accounts (COA)
CREATE TABLE IF NOT EXISTS public.chart_of_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('Asset', 'Liability', 'Equity', 'Revenue', 'Expense')),
    subtype TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pre-populate COA if empty
INSERT INTO public.chart_of_accounts (code, name, type, subtype)
SELECT * FROM (VALUES
    ('1000', 'Cash at Bank', 'Asset', 'Current Asset'),
    ('1010', 'Petty Cash', 'Asset', 'Current Asset'),
    ('1100', 'Accounts Receivable', 'Asset', 'Current Asset'),
    ('1200', 'Inventory - Raw Materials', 'Asset', 'Current Asset'),
    ('1210', 'Inventory - Finished Products', 'Asset', 'Current Asset'),
    ('1500', 'Equipment & Machinery', 'Asset', 'Fixed Asset'),
    ('2000', 'Accounts Payable', 'Liability', 'Current Liability'),
    ('2100', 'Accrued Expenses', 'Liability', 'Current Liability'),
    ('2200', 'Loans Payable', 'Liability', 'Long-term Liability'),
    ('3000', 'Capital / Common Stock', 'Equity', 'Equity'),
    ('3100', 'Retained Earnings', 'Equity', 'Equity'),
    ('4000', 'Sales Revenue', 'Revenue', 'Operating Revenue'),
    ('4100', 'Other Income', 'Revenue', 'Other Income'),
    ('5000', 'Cost of Goods Sold (COGS)', 'Expense', 'Direct Expense'),
    ('5100', 'Salaries & Wages', 'Expense', 'Operating Expense'),
    ('5200', 'Rent Expense', 'Expense', 'Operating Expense'),
    ('5300', 'Utilities', 'Expense', 'Operating Expense'),
    ('5400', 'Marketing & Sales', 'Expense', 'Operating Expense'),
    ('5500', 'Maintenance & Repairs', 'Expense', 'Operating Expense'),
    ('5600', 'Insurance', 'Expense', 'Operating Expense'),
    ('5700', 'Taxes & Licenses', 'Expense', 'Operating Expense')
) AS t(code, name, type, subtype)
WHERE NOT EXISTS (SELECT 1 FROM public.chart_of_accounts);

-- 2. Setup Journal Entries (DROP and RECREATE if columns are missing or table is empty)
DO $$ 
BEGIN 
    -- If table is empty, just recreate it for a clean start
    IF NOT EXISTS (SELECT 1 FROM public.journal_entries LIMIT 1) THEN
        DROP TABLE IF EXISTS public.journal_entries CASCADE;
    END IF;
END $$;

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

-- Ensure ALL columns exist (in case we didn't drop it)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='journal_entries' AND column_name='date') THEN
        ALTER TABLE public.journal_entries ADD COLUMN date DATE NOT NULL DEFAULT CURRENT_DATE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='journal_entries' AND column_name='debit_account') THEN
        ALTER TABLE public.journal_entries ADD COLUMN debit_account TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='journal_entries' AND column_name='debit_amount') THEN
        ALTER TABLE public.journal_entries ADD COLUMN debit_amount DECIMAL(15,2);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='journal_entries' AND column_name='credit_account') THEN
        ALTER TABLE public.journal_entries ADD COLUMN credit_account TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='journal_entries' AND column_name='credit_amount') THEN
        ALTER TABLE public.journal_entries ADD COLUMN credit_amount DECIMAL(15,2);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='journal_entries' AND column_name='entry_number') THEN
        ALTER TABLE public.journal_entries ADD COLUMN entry_number TEXT UNIQUE;
    END IF;
END $$;

-- 3. Setup Expenses
DO $$ 
BEGIN 
    -- If table is empty, just recreate it for a clean start
    IF NOT EXISTS (SELECT 1 FROM public.expenses LIMIT 1) THEN
        DROP TABLE IF EXISTS public.expenses CASCADE;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    category TEXT,
    description TEXT,
    amount DECIMAL(15,2),
    status TEXT DEFAULT 'Pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure ALL columns exist for expenses
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='expenses' AND column_name='date') THEN
        ALTER TABLE public.expenses ADD COLUMN date DATE NOT NULL DEFAULT CURRENT_DATE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='expenses' AND column_name='category') THEN
        ALTER TABLE public.expenses ADD COLUMN category TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='expenses' AND column_name='amount') THEN
        ALTER TABLE public.expenses ADD COLUMN amount DECIMAL(15,2);
    END IF;
END $$;

-- 4. Setup Petty Cash
CREATE TABLE IF NOT EXISTS public.petty_cash (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    voucher_number TEXT UNIQUE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    type TEXT,
    description TEXT,
    amount DECIMAL(15,2),
    category TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Create the Financial Ledger View (Joined with COA)
DROP VIEW IF EXISTS public.financial_ledgers;
CREATE OR REPLACE VIEW public.financial_ledgers AS
WITH all_entries AS (
    SELECT 
        'Journal' as source,
        date,
        debit_account as account_name,
        debit_amount as debit,
        0 as credit,
        description
    FROM public.journal_entries
    UNION ALL
    SELECT 
        'Journal' as source,
        date,
        credit_account as account_name,
        0 as debit,
        credit_amount as credit,
        description
    FROM public.journal_entries
    UNION ALL
    SELECT 
        'Expense' as source,
        date,
        category as account_name,
        amount as debit,
        0 as credit,
        description
    FROM public.expenses
    UNION ALL
    SELECT 
        'Petty Cash' as source,
        date,
        category as account_name,
        CASE WHEN type = 'Disbursement' THEN amount ELSE 0 END as debit,
        CASE WHEN type = 'Replenishment' THEN 0 ELSE amount END as credit,
        description
    FROM public.petty_cash
)
SELECT 
    e.*,
    c.type,
    c.subtype,
    c.code
FROM all_entries e
LEFT JOIN public.chart_of_accounts c ON e.account_name = c.name;

-- 6. Enable Security & Policies
ALTER TABLE public.chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.petty_cash ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    -- Chart of Accounts
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all on chart_of_accounts' AND tablename = 'chart_of_accounts') THEN
        CREATE POLICY "Allow all on chart_of_accounts" ON public.chart_of_accounts FOR ALL USING (true);
    END IF;
    -- Journal Entries
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all on journal_entries' AND tablename = 'journal_entries') THEN
        CREATE POLICY "Allow all on journal_entries" ON public.journal_entries FOR ALL USING (true);
    END IF;
    -- Expenses
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all on expenses' AND tablename = 'expenses') THEN
        CREATE POLICY "Allow all on expenses" ON public.expenses FOR ALL USING (true);
    END IF;
    -- Petty Cash
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all on petty_cash' AND tablename = 'petty_cash') THEN
        CREATE POLICY "Allow all on petty_cash" ON public.petty_cash FOR ALL USING (true);
    END IF;
END
$$;
