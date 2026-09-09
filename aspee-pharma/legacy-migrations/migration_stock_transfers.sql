-- ASPEE PHARMACEUTICALS - DATABASE MIGRATION FOR STOCK TRANSFERS
-- THIS SCRIPT DROPS AND RECREATES EMPTY TABLES TO ALIGN WITH UUID ID STRATEGY

-- 1. DROP EXISTING CONFLICTING TABLES
DROP TABLE IF EXISTS stock_transfer_items CASCADE;
DROP TABLE IF EXISTS stock_transfers CASCADE;
DROP TABLE IF EXISTS stock_levels CASCADE;
DROP TABLE IF EXISTS vans CASCADE;
DROP TABLE IF EXISTS stock_locations CASCADE;

-- 2. RECREATE stock_locations AS UUID
CREATE TABLE stock_locations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'Warehouse',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. SEED DEFAULT LOCATIONS
INSERT INTO stock_locations (name, type) VALUES
    ('Main Warehouse', 'Warehouse'),
    ('Production Floor', 'Production'),
    ('Cold Storage', 'Cold Storage'),
    ('Quarantine Zone', 'Quarantine')
ON CONFLICT DO NOTHING;

-- 4. RECREATE stock_levels WITH UUID FK
CREATE TABLE stock_levels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    location_id UUID REFERENCES stock_locations(id) ON DELETE CASCADE,
    qty_on_hand INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(product_id, location_id)
);

-- 5. RECREATE stock_transfers WITH UUID FKs
CREATE TABLE stock_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transfer_number TEXT UNIQUE NOT NULL,
    from_location_id UUID REFERENCES stock_locations(id),
    to_location_id UUID REFERENCES stock_locations(id),
    status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Shipped', 'Completed', 'Cancelled')),
    notes TEXT,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. RECREATE stock_transfer_items
CREATE TABLE stock_transfer_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transfer_id UUID REFERENCES stock_transfers(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    quantity INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. RECREATE vans
CREATE TABLE vans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    license_plate TEXT UNIQUE NOT NULL,
    driver_id UUID REFERENCES profiles(id),
    location_id UUID REFERENCES stock_locations(id),
    route_id UUID, 
    status TEXT DEFAULT 'Active'
);

-- 8. ENABLE ROW LEVEL SECURITY
ALTER TABLE stock_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transfer_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE vans ENABLE ROW LEVEL SECURITY;

-- 9. CREATE DEV POLICIES (ENABLE ALL)
CREATE POLICY "Enable all for all on stock_locations" ON stock_locations FOR ALL USING (true);
CREATE POLICY "Enable all for all on stock_levels" ON stock_levels FOR ALL USING (true);
CREATE POLICY "Enable all for all on stock_transfers" ON stock_transfers FOR ALL USING (true);
CREATE POLICY "Enable all for all on stock_transfer_items" ON stock_transfer_items FOR ALL USING (true);
CREATE POLICY "Enable all for all on vans" ON vans FOR ALL USING (true);
