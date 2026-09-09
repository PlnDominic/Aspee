-- ============================================================
-- Migration: Chart of Accounts & Financial Reporting Setup
-- ============================================================

-- 1. Create Chart of Accounts Table
CREATE TABLE IF NOT EXISTS chart_of_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('Asset', 'Liability', 'Equity', 'Revenue', 'Expense')),
    subtype TEXT, -- e.g., 'Current Asset', 'Fixed Asset', 'Operating Expense'
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Pre-populate with a Standard Chart of Accounts
INSERT INTO chart_of_accounts (code, name, type, subtype) VALUES
-- Assets
('1000', 'Cash at Bank', 'Asset', 'Current Asset'),
('1010', 'Petty Cash', 'Asset', 'Current Asset'),
('1100', 'Accounts Receivable', 'Asset', 'Current Asset'),
('1200', 'Inventory - Raw Materials', 'Asset', 'Current Asset'),
('1210', 'Inventory - Finished Products', 'Asset', 'Current Asset'),
('1500', 'Equipment & Machinery', 'Asset', 'Fixed Asset'),
-- Liabilities
('2000', 'Accounts Payable', 'Asset', 'Current Liability'), -- Oops, should be Liability
('2100', 'Accrued Expenses', 'Liability', 'Current Liability'),
('2200', 'Loans Payable', 'Liability', 'Long-term Liability'),
-- Equity
('3000', 'Capital / Common Stock', 'Equity', 'Equity'),
('3100', 'Retained Earnings', 'Equity', 'Equity'),
-- Revenue
('4000', 'Sales Revenue', 'Revenue', 'Operating Revenue'),
('4100', 'Other Income', 'Revenue', 'Other Income'),
-- Expenses
('5000', 'Cost of Goods Sold (COGS)', 'Expense', 'Direct Expense'),
('5100', 'Salaries & Wages', 'Expense', 'Operating Expense'),
('5200', 'Rent Expense', 'Expense', 'Operating Expense'),
('5300', 'Utilities', 'Expense', 'Operating Expense'),
('5400', 'Marketing & Sales', 'Expense', 'Operating Expense'),
('5500', 'Maintenance & Repairs', 'Expense', 'Operating Expense'),
('5600', 'Insurance', 'Expense', 'Operating Expense'),
('5700', 'Taxes & Licenses', 'Expense', 'Operating Expense');

-- Fix the typo for Accounts Payable
UPDATE chart_of_accounts SET type = 'Liability' WHERE code = '2000';

-- 3. Enable RLS
ALTER TABLE chart_of_accounts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Enable all for all on chart_of_accounts' AND tablename = 'chart_of_accounts') THEN
        CREATE POLICY "Enable all for all on chart_of_accounts" ON chart_of_accounts FOR ALL USING (true);
    END IF;
END
$$;

-- 4. Update Journal Entries to reference COA (Soft link via account_name or code)
-- For now, we will add a view to help with reporting
CREATE OR REPLACE VIEW financial_ledgers AS
SELECT 
    'Journal' as source,
    date,
    debit_account as account_name,
    debit_amount as debit,
    0 as credit,
    description
FROM journal_entries
UNION ALL
SELECT 
    'Journal' as source,
    date,
    credit_account as account_name,
    0 as debit,
    credit_amount as credit,
    description
FROM journal_entries
UNION ALL
-- Add Expenses (Simplified)
SELECT 
    'Expense' as source,
    date,
    category as account_name,
    amount as debit,
    0 as credit,
    description
FROM expenses
UNION ALL
-- Add Petty Cash
SELECT 
    'Petty Cash' as source,
    date,
    category as account_name,
    CASE WHEN type = 'Disbursement' THEN amount ELSE 0 END as debit,
    CASE WHEN type = 'Replenishment' THEN 0 ELSE amount END as credit,
    description
FROM petty_cash;
