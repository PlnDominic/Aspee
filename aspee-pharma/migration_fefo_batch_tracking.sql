-- ============================================================
-- Migration: Enable FEFO (First Expired, First Out) & Batch Tracking
-- Adds batch_number and expiry_date to stock_levels and stock_movements
-- ============================================================

-- 1. Add columns to stock_levels
ALTER TABLE stock_levels 
ADD COLUMN IF NOT EXISTS batch_number TEXT DEFAULT 'N/A',
ADD COLUMN IF NOT EXISTS expiry_date DATE;

-- 2. Drop old unique constraint (assuming standard naming or trying to drop by definition)
-- We need to be careful here. If the constraint name is unknown, we might need a DO block.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_levels_product_id_location_id_key') THEN
        ALTER TABLE stock_levels DROP CONSTRAINT stock_levels_product_id_location_id_key;
    END IF;
END $$;

-- 3. Add new unique constraint for Batch-level tracking
-- Using COALESCE for batch_number in index if we allowed NULLs, but we'll default to 'N/A'
-- However, we should probably make batch_number NOT NULL for strictness.
-- Let's update existing NULLs first just in case.
UPDATE stock_levels SET batch_number = 'N/A' WHERE batch_number IS NULL;

-- Create the new unique index
CREATE UNIQUE INDEX IF NOT EXISTS stock_levels_product_location_batch_idx 
ON stock_levels (product_id, location_id, batch_number);

-- 4. Add columns to stock_movements
ALTER TABLE stock_movements
ADD COLUMN IF NOT EXISTS batch_number TEXT,
ADD COLUMN IF NOT EXISTS expiry_date DATE;

-- 5. Add columns to grn_items (Just in case they are missing, though inspection said they exist)
ALTER TABLE grn_items
ADD COLUMN IF NOT EXISTS batch_number TEXT,
ADD COLUMN IF NOT EXISTS expiry_date DATE;
