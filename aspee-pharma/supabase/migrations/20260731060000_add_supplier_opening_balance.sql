-- Adds an opening balance to suppliers so the Supplier Profile view can show
-- a starting payable balance that predates this system (e.g. migrated from
-- spreadsheets), ahead of the PO/payment transaction history.
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS opening_balance numeric NOT NULL DEFAULT 0;
