-- ─────────────────────────────────────────────────────────────────────────────
-- Sales Manager Feature Additions
-- April 2026
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Products: add category
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS product_category  TEXT    DEFAULT 'Other Products';

-- 2. Sales Invoice Items: add discount, returns columns
ALTER TABLE sales_invoice_items
  ADD COLUMN IF NOT EXISTS discount_pct     NUMERIC(5,2)  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount  NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS returns_qty      NUMERIC(10,3) DEFAULT 0;

-- 3. System settings: add max_discount_pct (back-office ceiling)
INSERT INTO system_settings (key, value, updated_at)
VALUES ('max_discount_pct', '0', NOW())
ON CONFLICT (key) DO NOTHING;
