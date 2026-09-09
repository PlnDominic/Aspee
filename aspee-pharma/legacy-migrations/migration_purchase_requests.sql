-- Migration: Create Purchase Request System (Stores to Purchasing)
-- Description: Adds tables and RLS for stores to request purchases electronically.

-- 1. Create purchase_requests table
CREATE TABLE IF NOT EXISTS purchase_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_number TEXT UNIQUE NOT NULL,
    requested_by UUID REFERENCES system_users(id),
    status TEXT NOT NULL DEFAULT 'Pending',
    priority TEXT NOT NULL DEFAULT 'Normal',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create purchase_request_items table
CREATE TABLE IF NOT EXISTS purchase_request_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID REFERENCES purchase_requests(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    quantity DECIMAL NOT NULL,
    unit TEXT,
    last_purchase_price DECIMAL DEFAULT 0,
    last_purchase_date DATE,
    purpose TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Enable RLS
ALTER TABLE purchase_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_request_items ENABLE ROW LEVEL SECURITY;

-- 4. Create Policies (Simplified for now - Enable all)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Enable all for all on purchase_requests') THEN
        CREATE POLICY "Enable all for all on purchase_requests" ON purchase_requests FOR ALL USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Enable all for all on purchase_request_items') THEN
        CREATE POLICY "Enable all for all on purchase_request_items" ON purchase_request_items FOR ALL USING (true);
    END IF;
END $$;

-- 5. Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_purchase_requests') THEN
        CREATE TRIGGER set_updated_at_purchase_requests
        BEFORE UPDATE ON purchase_requests
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;
