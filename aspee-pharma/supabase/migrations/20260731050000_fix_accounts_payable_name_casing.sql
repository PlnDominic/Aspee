-- financial_ledgers shows NULL type/subtype for every "Accounts Payable"
-- journal entry, which makes Financial Position's "Trade Creditors &
-- Accruals" line total GH₵0 even though the entries themselves exist and the
-- supplier drill-down beneath it is correct.
--
-- Root cause: chart_of_accounts has this account named "Accounts payable"
-- (lowercase p, code 2000), but every GL posting in the app writes
-- journal_entries.debit_account/credit_account as "Accounts Payable"
-- (capital P) — see autoPostJournal.ts and the AP Ledger's queries. Whatever
-- join financial_ledgers uses to pull in type/subtype is case-sensitive, so
-- it never matches. Renaming the account to match the casing already used
-- everywhere else in the app is the low-risk fix — the lowercase spelling
-- appears in exactly one other place in the codebase (a manual-adjustment
-- save path in financial-position/page.tsx), which is being fixed in the
-- same commit as this migration.

UPDATE chart_of_accounts
SET name = 'Accounts Payable'
WHERE code = '2000'
  AND name = 'Accounts payable';
