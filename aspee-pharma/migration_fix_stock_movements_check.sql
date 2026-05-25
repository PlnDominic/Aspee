-- ============================================================
-- FIX: Stock Transfers not updating stock levels
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- ============================================================
-- 1. Fix reference_type check constraint on stock_movements
-- ============================================================
ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS stock_movements_reference_type_check;

ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_reference_type_check
  CHECK (reference_type IN (
    'Stock Transfer',
    'Sales Invoice',
    'GRN',
    'Material Request',
    'Job Order Consumption',
    'Job Order Yield',
    'QA Release',
    'QA Finished Goods',
    'Transfer',
    'Adjustment'
  ));

-- ============================================================
-- 2. Fix movement_type check constraint (if it exists)
--    The app uses 'IN' and 'OUT' but the original migration
--    only allowed 'PURCHASE','SALE','DAMAGED' etc.
-- ============================================================
ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS stock_movements_movement_type_check;

ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_movement_type_check
  CHECK (movement_type IN (
    'IN',
    'OUT',
    'PURCHASE',
    'SALE',
    'DAMAGED',
    'GIFT',
    'RETURN',
    'ADJUSTMENT',
    'REQUISITION'
  ));

-- ============================================================
-- 3. Ensure RLS policies allow all operations on stock_levels
--    (Without this, updates/inserts may silently fail)
-- ============================================================
ALTER TABLE stock_levels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all for all on stock_levels" ON stock_levels;
CREATE POLICY "Enable all for all on stock_levels"
  ON stock_levels FOR ALL
  USING (true) WITH CHECK (true);

-- ============================================================
-- 4. Ensure RLS policies allow all operations on stock_movements
-- ============================================================
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all for all on stock_movements" ON stock_movements;
CREATE POLICY "Enable all for all on stock_movements"
  ON stock_movements FOR ALL
  USING (true) WITH CHECK (true);

-- ============================================================
-- 5. Ensure RLS policies on stock_transfers and items
-- ============================================================
ALTER TABLE stock_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transfer_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all for all on stock_transfers" ON stock_transfers;
CREATE POLICY "Enable all for all on stock_transfers"
  ON stock_transfers FOR ALL
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all for all on stock_transfer_items" ON stock_transfer_items;
CREATE POLICY "Enable all for all on stock_transfer_items"
  ON stock_transfer_items FOR ALL
  USING (true) WITH CHECK (true);

-- ============================================================
-- 6. Clean up any orphaned transfers where stock didn't move
--    (transfers that exist but stock_movements were never created)
-- ============================================================
-- This SELECT shows orphaned transfers — review before deleting:
-- SELECT t.id, t.transfer_number, t.created_at
-- FROM stock_transfers t
-- LEFT JOIN stock_movements m ON m.reference_id = t.id AND m.reference_type = 'Stock Transfer'
-- WHERE m.id IS NULL;
