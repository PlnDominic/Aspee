-- One-time backfill: post the "PO Approved" GL entry (DR Inventory / CR
-- Accounts Payable) for every purchase order that is already
-- Approved/Shipped/Received but predates the new autoPostJournal('PO_APPROVED')
-- trigger added in the app. Without this, the AP Ledger's Billed column
-- (which now reads PO status directly) will show these POs immediately, but
-- the GL's Accounts Payable balance won't include them until this runs —
-- reopening the subledger/GL variance for exactly these POs.
--
-- Idempotent: skips any PO that already has a matching 'Auto-posted from PO
-- <po_number>' entry, or one posted via the GRN-approval backstop
-- ('Auto-posted from GRN <grn_number>' for a GRN linked to that PO) — safe
-- to re-run.

INSERT INTO journal_entries (
    entry_number, date, description, ref_type,
    debit_account, debit_amount, credit_account, credit_amount,
    created_by, notes, counterparty_name
)
SELECT
    'PO-' || to_char(now(), 'YYMM') || '-' || lpad((1000 + floor(random() * 9000))::int::text, 4, '0'),
    coalesce(po.approved_at::date, po.created_at::date, current_date),
    'Purchase Order ' || po.po_number || ' approved (backfill)',
    'Purchase',
    'Inventory - Raw Materials',
    po.total_amount,
    'Accounts Payable',
    po.total_amount,
    'System',
    'Auto-posted from PO ' || po.po_number,
    s.name
FROM purchase_orders po
LEFT JOIN suppliers s ON s.id = po.supplier_id
WHERE po.status NOT IN ('Pending', 'Draft', 'Cancelled', 'Rejected')
  AND coalesce(po.total_amount, 0) > 0
  AND NOT EXISTS (
      SELECT 1 FROM journal_entries je
      WHERE je.notes = 'Auto-posted from PO ' || po.po_number
  )
  AND NOT EXISTS (
      SELECT 1 FROM grn g
      JOIN journal_entries je ON je.notes = 'Auto-posted from GRN ' || g.grn_number
      WHERE g.po_id = po.id
  );
