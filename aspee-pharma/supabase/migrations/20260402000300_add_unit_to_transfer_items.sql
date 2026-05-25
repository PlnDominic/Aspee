-- Add unit column to stock_transfer_items for consistency
ALTER TABLE stock_transfer_items ADD COLUMN IF NOT EXISTS unit TEXT;

-- Update existing records to have the product's unit
UPDATE stock_transfer_items sti
SET unit = p.unit
FROM products p
WHERE sti.product_id = p.id
  AND sti.unit IS NULL;
