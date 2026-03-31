-- ============================================================
-- Migration: Link Production ↔ QA Approval Workflow
-- ============================================================

-- Stage 1: QA approval gate on material requests
ALTER TABLE material_requests
  ADD COLUMN IF NOT EXISTS qa_status TEXT NOT NULL DEFAULT 'Not Required',
  ADD COLUMN IF NOT EXISTS qa_approved_by TEXT,
  ADD COLUMN IF NOT EXISTS qa_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS qa_notes TEXT;

-- Stage 2: Link QA in-process checks to a production order
ALTER TABLE qa_in_process
  ADD COLUMN IF NOT EXISTS production_order_id UUID REFERENCES production_orders(id) ON DELETE SET NULL;

-- Stage 2: Link QA finished product analyses to a production order
ALTER TABLE qa_finished_products
  ADD COLUMN IF NOT EXISTS production_order_id UUID REFERENCES production_orders(id) ON DELETE SET NULL;

-- Helpful index for looking up QA records by production order
CREATE INDEX IF NOT EXISTS idx_qa_inprocess_prod_order ON qa_in_process(production_order_id);
CREATE INDEX IF NOT EXISTS idx_qa_finished_prod_order  ON qa_finished_products(production_order_id);
CREATE INDEX IF NOT EXISTS idx_material_req_qa_status  ON material_requests(qa_status);
