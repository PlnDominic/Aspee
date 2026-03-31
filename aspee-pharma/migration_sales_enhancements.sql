-- ============================================================
-- Migration: Sales Module Enhancements
-- Adds support for: Price Lists, Payment Schedules, Multiple Invoices per Receipt, Returns, Credit Notes
-- ============================================================

-- 1. Modify existing sales_invoices
ALTER TABLE sales_invoices
ADD COLUMN IF NOT EXISTS amount_paid DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'Unpaid',
ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS price_list_id UUID; -- Reference added later

-- 2. Modify existing sales_receipts (Drop invoice_id)
-- Note: It's technically better to migrate existing data before dropping, but for this migration we assume it's acceptable to redefine relationships.
ALTER TABLE sales_receipts
DROP COLUMN IF EXISTS invoice_id CASCADE;

-- 3. Create Price Lists & Items
CREATE TABLE IF NOT EXISTS price_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS price_list_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    price_list_id UUID REFERENCES price_lists(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    unit_price DECIMAL(15,2) NOT NULL,
    discount_percentage DECIMAL(5,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(price_list_id, product_id)
);

ALTER TABLE sales_invoices
ADD CONSTRAINT fk_sales_invoices_price_list
FOREIGN KEY (price_list_id) REFERENCES price_lists(id) ON DELETE SET NULL;

-- 4. Create Payment Schedules
CREATE TABLE IF NOT EXISTS payment_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID REFERENCES sales_invoices(id) ON DELETE CASCADE,
    amount DECIMAL(15,2) NOT NULL,
    due_date DATE NOT NULL,
    status TEXT DEFAULT 'Pending', -- Pending, Paid, Overdue
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Create Sales Receipt Items (Many-to-Many linking Receipts & Invoices)
CREATE TABLE IF NOT EXISTS sales_receipt_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_id UUID REFERENCES sales_receipts(id) ON DELETE CASCADE,
    invoice_id UUID REFERENCES sales_invoices(id) ON DELETE CASCADE,
    amount_applied DECIMAL(15,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Create Sales Returns & Items
CREATE TABLE IF NOT EXISTS sales_returns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    return_number TEXT UNIQUE NOT NULL,
    invoice_id UUID REFERENCES sales_invoices(id) ON DELETE CASCADE,
    customer_name TEXT NOT NULL,
    date DATE NOT NULL,
    reason TEXT,
    status TEXT DEFAULT 'Pending Review', -- Pending Review, Approved, Rejected
    total_refund_amount DECIMAL(15,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sales_return_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    return_id UUID REFERENCES sales_returns(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    quantity_returned DECIMAL(15,2) NOT NULL,
    unit_price DECIMAL(15,2) NOT NULL,
    refund_amount DECIMAL(15,2) NOT NULL,
    restock BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Create Credit Notes
CREATE TABLE IF NOT EXISTS credit_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    credit_note_number TEXT UNIQUE NOT NULL,
    customer_name TEXT NOT NULL,
    return_id UUID REFERENCES sales_returns(id) ON DELETE SET NULL,
    date DATE NOT NULL,
    original_amount DECIMAL(15,2) NOT NULL,
    remaining_balance DECIMAL(15,2) NOT NULL,
    status TEXT DEFAULT 'Active', -- Active, Fully Applied, Void
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Enable RLS
ALTER TABLE price_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_receipt_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_return_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_notes ENABLE ROW LEVEL SECURITY;

-- 9. RLS Policies
DO $$
BEGIN
    -- Price Lists
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Enable all for all on price_lists') THEN
        CREATE POLICY "Enable all for all on price_lists" ON price_lists FOR ALL USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Enable all for all on price_list_items') THEN
        CREATE POLICY "Enable all for all on price_list_items" ON price_list_items FOR ALL USING (true);
    END IF;

    -- Payment Schedules
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Enable all for all on payment_schedules') THEN
        CREATE POLICY "Enable all for all on payment_schedules" ON payment_schedules FOR ALL USING (true);
    END IF;

    -- Sales Receipt Items
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Enable all for all on sales_receipt_items') THEN
        CREATE POLICY "Enable all for all on sales_receipt_items" ON sales_receipt_items FOR ALL USING (true);
    END IF;

    -- Sales Returns
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Enable all for all on sales_returns') THEN
        CREATE POLICY "Enable all for all on sales_returns" ON sales_returns FOR ALL USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Enable all for all on sales_return_items') THEN
        CREATE POLICY "Enable all for all on sales_return_items" ON sales_return_items FOR ALL USING (true);
    END IF;

    -- Credit Notes
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Enable all for all on credit_notes') THEN
        CREATE POLICY "Enable all for all on credit_notes" ON credit_notes FOR ALL USING (true);
    END IF;
END
$$;

-- 10. Triggers for updated_at
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DO $$
BEGIN
    -- price_lists
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_price_lists_updated_at') THEN
        CREATE TRIGGER update_price_lists_updated_at BEFORE UPDATE ON price_lists FOR EACH ROW EXECUTE FUNCTION update_timestamp();
    END IF;
    
    -- payment_schedules
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_payment_schedules_updated_at') THEN
        CREATE TRIGGER update_payment_schedules_updated_at BEFORE UPDATE ON payment_schedules FOR EACH ROW EXECUTE FUNCTION update_timestamp();
    END IF;
    
    -- sales_returns
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_sales_returns_updated_at') THEN
        CREATE TRIGGER update_sales_returns_updated_at BEFORE UPDATE ON sales_returns FOR EACH ROW EXECUTE FUNCTION update_timestamp();
    END IF;

    -- credit_notes
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_credit_notes_updated_at') THEN
        CREATE TRIGGER update_credit_notes_updated_at BEFORE UPDATE ON credit_notes FOR EACH ROW EXECUTE FUNCTION update_timestamp();
    END IF;
END
$$;
