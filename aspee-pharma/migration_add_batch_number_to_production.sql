-- Migration: Add batch_number to production_orders
-- Description: Adds the batch_number column to production_orders to align with QA modal expectations.

-- 1. Add batch_number column
ALTER TABLE production_orders ADD COLUMN IF NOT EXISTS batch_number TEXT;

-- 2. Populate existing records with a default batch number derived from order_number
UPDATE production_orders 
SET batch_number = 'BATCH-' || order_number 
WHERE batch_number IS NULL;

-- 3. Update any orders that are 'Completed' if they don't have a batch number
-- (Already covered by the generic UPDATE above, but keeping it in mind)
