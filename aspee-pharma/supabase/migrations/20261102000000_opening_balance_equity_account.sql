-- Adds the "Opening Balance Equity" suspense account used by
-- postOpeningBalanceJournal() (src/lib/autoPostJournal.ts) when a customer's
-- or supplier's opening balance is posted to the GL. Without this row the
-- journal entry still posts fine (debit_account/credit_account are plain
-- text, not FK-constrained), but it won't be classified under Equity on the
-- Statement of Financial Position (Accounting -> Financial Position).
--
-- Guarded so it's a no-op if the table doesn't exist yet, or the account
-- (by name) already does -- adjust the `code` below if '3900' collides with
-- your existing chart of accounts numbering.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'chart_of_accounts'
    ) AND NOT EXISTS (
        SELECT 1 FROM public.chart_of_accounts WHERE name = 'Opening Balance Equity'
    ) THEN
        INSERT INTO public.chart_of_accounts (code, name, type, subtype, is_active)
        VALUES ('3900', 'Opening Balance Equity', 'Equity', 'Equity', true);
    END IF;
END $$;
