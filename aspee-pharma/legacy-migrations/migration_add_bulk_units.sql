-- Add bulk unit support to products
-- Base unit = existing `unit` field (e.g., "Bottles")
-- Bulk unit = outer packaging unit (e.g., "Cartons")
-- bulk_to_base_ratio = how many base units per bulk unit (e.g., 30 → 1 Carton = 30 Bottles)

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS bulk_unit TEXT,
  ADD COLUMN IF NOT EXISTS bulk_to_base_ratio NUMERIC(12, 4) DEFAULT 1;

-- Ensure ratio is always positive when set
ALTER TABLE products
  ADD CONSTRAINT IF NOT EXISTS chk_bulk_to_base_ratio_positive
  CHECK (bulk_to_base_ratio IS NULL OR bulk_to_base_ratio > 0);
