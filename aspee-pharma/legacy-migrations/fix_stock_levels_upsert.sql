-- ASPEE PHARMACEUTICALS - STOCK LEVELS CONSTRAINT FIX
-- Run this in the Supabase SQL Editor to fix the "ON CONFLICT" error.

-- 1. Ensure data consistency (no NULLs in batch_number)
UPDATE stock_levels SET batch_number = 'N/A' WHERE batch_number IS NULL;

-- 2. Drop the old index if it was created without a constraint
-- (Postgres ON CONFLICT often requires a named CONSTRAINT or a perfect index match)
DROP INDEX IF EXISTS stock_levels_product_location_batch_idx;

-- 3. Drop the old unique constraint (from before batch tracking was added)
ALTER TABLE stock_levels DROP CONSTRAINT IF EXISTS stock_levels_product_id_location_id_key;

-- 4. Add the formal UNIQUE CONSTRAINT that matches the code's onConflict specification
-- If this fails, it means you have duplicate rows for the same Product + Location + Batch.
-- In that case, you must manually delete or merge the duplicates before running this.
ALTER TABLE stock_levels 
ADD CONSTRAINT stock_levels_product_location_batch_key 
UNIQUE (product_id, location_id, batch_number);

-- 5. Optional: Verify the change
-- SELECT conname, contype FROM pg_constraint WHERE conrelid = 'stock_levels'::regclass;
