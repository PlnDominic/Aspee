-- Corrective fix: the original PO-approval backfill (20260731030000) and the
-- PO_APPROVED/GRN_APPROVED/SUPPLIER_PAYMENT postings (before this session's
-- currency fix) posted the raw purchase_orders.total_amount / payment amount
-- straight to the GL — for a USD PO, that means the GL got the dollar figure
-- instead of its GH₵ equivalent, understating the real liability/cash entry.
--
-- Run the SELECT first to see what would change. Each UPDATE only touches
-- rows that still hold the raw, unconverted amount (within 1 cent of
-- po.total_amount) for a PO whose currency isn't GHS — so it's safe to
-- re-run: once corrected, a row no longer matches and is left alone.

-- 1. Preview: PO-approval entries (live postings + the earlier backfill)
SELECT je.id, je.notes, je.debit_amount AS currently_posted,
       po.currency, po.exchange_rate, po.total_amount,
       po.total_amount * po.exchange_rate AS correct_ghs_amount
FROM journal_entries je
JOIN purchase_orders po ON je.notes = 'Auto-posted from PO ' || po.po_number
WHERE po.currency <> 'GHS'
  AND coalesce(po.exchange_rate, 1) <> 1
  AND abs(je.debit_amount - po.total_amount) < 0.01;

-- 2. Preview: GRN-approval backstop entries
SELECT je.id, je.notes, je.debit_amount AS currently_posted,
       po.currency, po.exchange_rate
FROM journal_entries je
JOIN grn g ON je.notes = 'Auto-posted from GRN ' || g.grn_number
JOIN purchase_orders po ON po.id = g.po_id
WHERE po.currency <> 'GHS'
  AND coalesce(po.exchange_rate, 1) <> 1;

-- 3. Preview: supplier payment entries
SELECT je.id, je.notes, je.debit_amount AS currently_posted,
       po.currency, po.exchange_rate, sp.amount AS payment_native_amount,
       sp.amount * po.exchange_rate AS correct_ghs_amount
FROM journal_entries je
JOIN supplier_payments sp ON je.notes = 'Auto-posted from Supplier Payment ' || sp.payment_number
JOIN purchase_orders po ON po.id = sp.po_id
WHERE po.currency <> 'GHS'
  AND coalesce(po.exchange_rate, 1) <> 1
  AND abs(je.debit_amount - sp.amount) < 0.01;

-- ── Once you've reviewed the previews above, run these to apply the fix ──

-- 4. Correct PO-approval entries
UPDATE journal_entries je
SET debit_amount = po.total_amount * po.exchange_rate,
    credit_amount = po.total_amount * po.exchange_rate
FROM purchase_orders po
WHERE je.notes = 'Auto-posted from PO ' || po.po_number
  AND po.currency <> 'GHS'
  AND coalesce(po.exchange_rate, 1) <> 1
  AND abs(je.debit_amount - po.total_amount) < 0.01;

-- 5. GRN-approval backstop entries are NOT auto-corrected here — unlike the
-- other two, there's no single stored "native amount" field to compare
-- against (it's summed from grn_items unit_price * quantity_received), so a
-- blind multiply would double-convert if this script is ever re-run. Check
-- preview query #2 above: if it returns rows, multiply each one's
-- debit_amount/credit_amount by its exchange_rate manually, once.

-- 6. Correct supplier payment entries
UPDATE journal_entries je
SET debit_amount = sp.amount * po.exchange_rate,
    credit_amount = sp.amount * po.exchange_rate
FROM supplier_payments sp
JOIN purchase_orders po ON po.id = sp.po_id
WHERE je.notes = 'Auto-posted from Supplier Payment ' || sp.payment_number
  AND po.currency <> 'GHS'
  AND coalesce(po.exchange_rate, 1) <> 1
  AND abs(je.debit_amount - sp.amount) < 0.01;
