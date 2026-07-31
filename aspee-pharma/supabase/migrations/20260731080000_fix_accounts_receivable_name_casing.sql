-- Same bug as 20260731050000 (Accounts Payable), on the receivable side:
-- if chart_of_accounts has this account as "Accounts receivable" (lowercase
-- r) while every GL posting in the app writes journal_entries.debit_account/
-- credit_account as "Accounts Receivable" (capital R) — see
-- transactional_invoice_posting.sql, transactional_receipt_posting.sql,
-- autoPostJournal.ts — then financial_ledgers' join never matches and
-- Financial Position's "Receivables" line shows GH₵0 despite the entries
-- existing. Renames the account to match the casing used everywhere else.
UPDATE chart_of_accounts
SET name = 'Accounts Receivable'
WHERE name = 'Accounts receivable';
