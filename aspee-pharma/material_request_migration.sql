-- ASPEE PHARMACEUTICALS - MATERIAL REQUEST WORKFLOW MIGRATION
-- This script creates the tables needed for Production to request materials from Stores

-- 1. MATERIAL REQUESTS HEADER
CREATE TABLE IF NOT EXISTS material_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_number TEXT UNIQUE NOT NULL,
    production_order_id UUID REFERENCES production_orders(id) ON DELETE SET NULL,
    priority TEXT DEFAULT 'Medium', -- Low, Medium, High, Urgent
    status TEXT DEFAULT 'Pending', -- Pending, Issued, Partial, Cancelled
    notes TEXT,
    requested_by UUID, -- Link to users/auth if implemented later
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. MATERIAL REQUEST ITEMS
CREATE TABLE IF NOT EXISTS material_request_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID REFERENCES material_requests(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    quantity_requested DECIMAL(15,2) NOT NULL,
    quantity_issued DECIMAL(15,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. ENABLE RLS
ALTER TABLE material_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_request_items ENABLE ROW LEVEL SECURITY;

-- 4. POLICIES (Idempotent)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Enable all for all on material_requests') THEN
        CREATE POLICY "Enable all for all on material_requests" ON material_requests FOR ALL USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Enable all for all on material_request_items') THEN
        CREATE POLICY "Enable all for all on material_request_items" ON material_request_items FOR ALL USING (true);
    END IF;
END $$;

-- 5. FUNCTION TO UPDATE UPDATED_AT
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_material_requests_updated_at ON material_requests;
CREATE TRIGGER update_material_requests_updated_at
    BEFORE UPDATE ON material_requests
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();
