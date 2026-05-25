-- Fix: add unit_price to products and drop the broken current_stock materialized view.
-- The complete_sales_system migration was never fully applied to the remote DB,
-- leaving a current_stock materialized view referencing columns (product_type,
-- batch_number, stock_quantity, unit_price) that don't exist on products.
-- That broken view causes PostgREST to error on every query against products.
-- The current_stock view is unused by the app (all stock reads use stock_levels).

DROP MATERIALIZED VIEW IF EXISTS current_stock;

ALTER TABLE products
    ADD COLUMN IF NOT EXISTS unit_price DECIMAL(12,2) DEFAULT 0;

UPDATE products
SET unit_price = COALESCE(cash_price, credit_price, 0)
WHERE unit_price = 0 AND (cash_price IS NOT NULL OR credit_price IS NOT NULL);
