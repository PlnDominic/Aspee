-- ============================================================
-- Fix: qa_in_process schema gaps
-- Run this once in the Supabase SQL Editor.
-- It is idempotent — safe to run multiple times.
-- ============================================================

-- 1. Add production_order_id FK (required for linking IPC records to Job Orders)
ALTER TABLE qa_in_process
  ADD COLUMN IF NOT EXISTS production_order_id UUID
  REFERENCES production_orders(id) ON DELETE SET NULL;

-- 2. Add notes column if it was somehow dropped
ALTER TABLE qa_in_process
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- 3. Helpful index for looking up IPC records by production order
CREATE INDEX IF NOT EXISTS idx_qa_inprocess_prod_order
  ON qa_in_process(production_order_id);

-- 4. Ensure RLS allows authenticated users full access
ALTER TABLE qa_in_process ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated select on qa_in_process" ON qa_in_process;
DROP POLICY IF EXISTS "Allow authenticated insert on qa_in_process" ON qa_in_process;
DROP POLICY IF EXISTS "Allow authenticated update on qa_in_process" ON qa_in_process;
DROP POLICY IF EXISTS "Allow authenticated delete on qa_in_process" ON qa_in_process;
DROP POLICY IF EXISTS "Enable all for all on qa_in_process" ON qa_in_process;

CREATE POLICY "Allow authenticated select on qa_in_process"
  ON qa_in_process FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert on qa_in_process"
  ON qa_in_process FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update on qa_in_process"
  ON qa_in_process FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated delete on qa_in_process"
  ON qa_in_process FOR DELETE TO authenticated USING (true);
