-- ─────────────────────────────────────────────────────────────────────────────
-- Fix: Add missing columns to sales_invoice_items and sales_invoices
-- Covers: discount_pct, discount_amount, returns_qty, cash_sale, credit_sale
--         on line items; and total_discount on the invoice header.
-- All statements use IF NOT EXISTS — safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Per-line discount fields (from sales manager features migration, may be unapplied)
ALTER TABLE sales_invoice_items
  ADD COLUMN IF NOT EXISTS discount_pct    NUMERIC(5,2)  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS returns_qty     NUMERIC(10,3) DEFAULT 0;

-- 2. Per-line cash / credit split (new — was never in any migration)
ALTER TABLE sales_invoice_items
  ADD COLUMN IF NOT EXISTS cash_sale   NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credit_sale NUMERIC(12,2) DEFAULT 0;

-- 3. Invoice header: total discount summary (new — was never in any migration)
ALTER TABLE sales_invoices
  ADD COLUMN IF NOT EXISTS total_discount NUMERIC(12,2) DEFAULT 0;
