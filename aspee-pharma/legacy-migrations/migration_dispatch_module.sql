-- ============================================================
-- Migration: Dispatch & Delivery Module
-- Adds support for: Dispatch planning, Van assignments, Delivery Notes, and POD
-- ============================================================

-- 1. Create Dispatches Table
CREATE TABLE IF NOT EXISTS dispatches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dispatch_number TEXT UNIQUE NOT NULL,
    van_id UUID REFERENCES vans(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'Draft' CHECK (status IN ('Draft', 'Pending', 'In Transit', 'Completed', 'Cancelled')),
    dispatch_date DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create Dispatch Items (Linking Invoices to Dispatches)
CREATE TABLE IF NOT EXISTS dispatch_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dispatch_id UUID REFERENCES dispatches(id) ON DELETE CASCADE,
    invoice_id UUID REFERENCES sales_invoices(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Delivered', 'Failed', 'Returned')),
    delivery_confirmation_date TIMESTAMPTZ,
    recipient_name TEXT,
    signature_data TEXT, -- Placeholder for signature image/data
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(dispatch_id, invoice_id)
);

-- 3. Add Dispatch related columns to sales_invoices for quick lookup
ALTER TABLE sales_invoices
ADD COLUMN IF NOT EXISTS dispatch_status TEXT DEFAULT 'Pending' CHECK (dispatch_status IN ('Pending', 'Dispatched', 'Delivered', 'Returned'));

-- 4. Enable RLS
ALTER TABLE dispatches ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatch_items ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS Policies
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Enable all for all on dispatches') THEN
        CREATE POLICY "Enable all for all on dispatches" ON dispatches FOR ALL USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Enable all for all on dispatch_items') THEN
        CREATE POLICY "Enable all for all on dispatch_items" ON dispatch_items FOR ALL USING (true);
    END IF;
END
$$;

-- 6. Trigger for updated_at on dispatches
CREATE OR REPLACE FUNCTION update_dispatches_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_dispatches_updated_at ON dispatches;
CREATE TRIGGER update_dispatches_updated_at
    BEFORE UPDATE ON dispatches
    FOR EACH ROW
    EXECUTE FUNCTION update_dispatches_updated_at();

-- 7. Automated update of invoice dispatch_status based on dispatch_items
CREATE OR REPLACE FUNCTION update_invoice_dispatch_status()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE sales_invoices SET dispatch_status = 'Dispatched' WHERE id = NEW.invoice_id;
    ELSIF (TG_OP = 'UPDATE') THEN
        IF NEW.status = 'Delivered' THEN
            UPDATE sales_invoices SET dispatch_status = 'Delivered' WHERE id = NEW.invoice_id;
        ELSIF NEW.status = 'Returned' THEN
            UPDATE sales_invoices SET dispatch_status = 'Returned' WHERE id = NEW.invoice_id;
        END IF;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE sales_invoices SET dispatch_status = 'Pending' WHERE id = OLD.invoice_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_invoice_dispatch_status ON dispatch_items;
CREATE TRIGGER trg_update_invoice_dispatch_status
    AFTER INSERT OR UPDATE OR DELETE ON dispatch_items
    FOR EACH ROW
    EXECUTE FUNCTION update_invoice_dispatch_status();
