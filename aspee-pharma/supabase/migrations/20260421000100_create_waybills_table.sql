-- ASPEE PHARMACEUTICALS - WAYBILL SYSTEM
-- Schema for tracking and saving van waybills

-- 1. Create waybills header table
CREATE TABLE IF NOT EXISTS waybills (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    waybill_number TEXT UNIQUE NOT NULL,
    sales_person_name TEXT NOT NULL,
    van_id UUID REFERENCES vans(id) ON DELETE SET NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    grand_total DECIMAL(12,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create waybill items table
CREATE TABLE IF NOT EXISTS waybill_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    waybill_id UUID REFERENCES waybills(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE RESTRICT,
    current_stock INTEGER DEFAULT 0,
    qty_returned INTEGER DEFAULT 0,
    qty_received_from_stores INTEGER DEFAULT 0,
    total_qty INTEGER DEFAULT 0,
    total_value DECIMAL(12,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Add RLS Policies
ALTER TABLE waybills ENABLE ROW LEVEL SECURITY;
ALTER TABLE waybill_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read waybills" ON waybills
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to insert waybills" ON waybills
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to read waybill_items" ON waybill_items
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to insert waybill_items" ON waybill_items
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 4. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_waybills_van_id ON waybills(van_id);
CREATE INDEX IF NOT EXISTS idx_waybills_date ON waybills(date);
CREATE INDEX IF NOT EXISTS idx_waybill_items_waybill_id ON waybill_items(waybill_id);
CREATE INDEX IF NOT EXISTS idx_waybill_items_product_id ON waybill_items(product_id);
