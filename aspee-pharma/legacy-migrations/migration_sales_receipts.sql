-- ============================================================
-- Migration: Add Sales Receipts Table
-- ============================================================

CREATE TABLE IF NOT EXISTS sales_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_number TEXT UNIQUE NOT NULL,
    invoice_id UUID REFERENCES sales_invoices(id) ON DELETE CASCADE,
    customer_name TEXT NOT NULL,
    date DATE NOT NULL,
    payment_method TEXT NOT NULL,
    payment_reference TEXT,
    amount DECIMAL(15,2) NOT NULL,
    currency TEXT DEFAULT 'GHS',
    notes TEXT,
    status TEXT DEFAULT 'Confirmed',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE sales_receipts ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Enable all for all on sales_receipts' AND tablename = 'sales_receipts') THEN
        CREATE POLICY "Enable all for all on sales_receipts" ON sales_receipts FOR ALL USING (true);
    END IF;
END
$$;

-- Updated_at Automations
CREATE OR REPLACE FUNCTION update_sales_receipts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_sales_receipts_updated_at ON sales_receipts;
CREATE TRIGGER update_sales_receipts_updated_at
    BEFORE UPDATE ON sales_receipts
    FOR EACH ROW
    EXECUTE FUNCTION update_sales_receipts_updated_at();
