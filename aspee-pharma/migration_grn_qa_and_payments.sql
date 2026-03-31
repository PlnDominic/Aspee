-- ============================================================
-- Migration: GRN Quality Assurance Fields + Supplier Payments
-- ============================================================

-- 1. Add QA fields to GRN table
ALTER TABLE grn
    ADD COLUMN IF NOT EXISTS qa_status TEXT DEFAULT 'Pending' CHECK (qa_status IN ('Pending', 'Approved', 'Rejected', 'Quarantine')),
    ADD COLUMN IF NOT EXISTS qa_inspector TEXT,
    ADD COLUMN IF NOT EXISTS qa_date TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS goods_condition TEXT DEFAULT 'Good' CHECK (goods_condition IN ('Good', 'Damaged', 'Partial Damage')),
    ADD COLUMN IF NOT EXISTS qa_remarks TEXT;

-- 2. Add condition field per GRN item
ALTER TABLE grn_items
    ADD COLUMN IF NOT EXISTS item_condition TEXT DEFAULT 'Good' CHECK (item_condition IN ('Good', 'Damaged', 'Partial Damage')),
    ADD COLUMN IF NOT EXISTS condition_notes TEXT;

-- 3. Create supplier_payments table
CREATE TABLE IF NOT EXISTS supplier_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_number TEXT UNIQUE NOT NULL,
    po_id UUID REFERENCES purchase_orders(id) ON DELETE SET NULL,
    supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    payment_method TEXT NOT NULL CHECK (payment_method IN ('Bank Transfer', 'Cheque', 'Cash')),
    payment_reference TEXT,
    amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Completed', 'Cancelled')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Enable RLS on supplier_payments
ALTER TABLE supplier_payments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Enable all for all on supplier_payments' AND tablename = 'supplier_payments') THEN
        CREATE POLICY "Enable all for all on supplier_payments" ON supplier_payments FOR ALL USING (true) WITH CHECK (true);
    END IF;
END
$$;

-- 5. Add payment_status to purchase_orders
ALTER TABLE purchase_orders
    ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'Unpaid' CHECK (payment_status IN ('Unpaid', 'Partial', 'Paid'));
