-- Adds an opening balance to customers so bulk-imported customer accounts can
-- carry a starting receivable balance that predates this system (e.g. migrated
-- from spreadsheets), ahead of the invoice/receipt transaction history. Mirrors
-- the suppliers.opening_balance column added in 20260731060000.
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS opening_balance numeric NOT NULL DEFAULT 0;
