-- ============================================================
-- Migration: Add Sales Invoices Tables
-- ============================================================

-- 1. Create Sales Invoices Header
CREATE TABLE IF NOT EXISTS sales_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number TEXT UNIQUE NOT NULL,
    customer_name TEXT NOT NULL,
    date DATE NOT NULL,
    due_date DATE,
    type TEXT DEFAULT 'Credit Sale',
    status TEXT DEFAULT 'Draft',
    total_amount DECIMAL(15,2) DEFAULT 0,
    tax_amount DECIMAL(15,2) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create Sales Invoice Items
CREATE TABLE IF NOT EXISTS sales_invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID REFERENCES sales_invoices(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    quantity DECIMAL(15,2) NOT NULL,
    unit_price DECIMAL(15,2) NOT NULL,
    total_price DECIMAL(15,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Enable RLS
ALTER TABLE sales_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_invoice_items ENABLE ROW LEVEL SECURITY;

-- 4. Policies
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Enable all for all on sales_invoices' AND tablename = 'sales_invoices') THEN
        CREATE POLICY "Enable all for all on sales_invoices" ON sales_invoices FOR ALL USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Enable all for all on sales_invoice_items' AND tablename = 'sales_invoice_items') THEN
        CREATE POLICY "Enable all for all on sales_invoice_items" ON sales_invoice_items FOR ALL USING (true);
    END IF;
END
$$;

-- 5. Updated_at Automations
CREATE OR REPLACE FUNCTION update_sales_invoices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_sales_invoices_updated_at ON sales_invoices;
CREATE TRIGGER update_sales_invoices_updated_at
    BEFORE UPDATE ON sales_invoices
    FOR EACH ROW
    EXECUTE PROCEDURE update_sales_invoices_updated_at();
