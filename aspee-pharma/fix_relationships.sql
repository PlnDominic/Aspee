-- Create the stock_locations table if it doesn't exist
CREATE TABLE IF NOT EXISTS stock_locations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'Warehouse',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Drop the restrictive check constraint if it exists to allow our seed data
ALTER TABLE stock_locations DROP CONSTRAINT IF EXISTS stock_locations_type_check;

-- Seed some default locations
INSERT INTO stock_locations (name, type) VALUES
    ('Main Warehouse', 'Warehouse'),
    ('Production Floor', 'Production'),
    ('Cold Storage', 'Cold Storage'),
    ('Quarantine Zone', 'Quarantine')
ON CONFLICT DO NOTHING;

-- Ensure stock_transfers exists and has the correct columns
CREATE TABLE IF NOT EXISTS stock_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transfer_number TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'Pending',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure foreign key columns exist with correct constraints
ALTER TABLE stock_transfers 
    ADD COLUMN IF NOT EXISTS from_location_id UUID REFERENCES stock_locations(id),
    ADD COLUMN IF NOT EXISTS to_location_id UUID REFERENCES stock_locations(id);

-- Ensure stock_transfer_items exists
CREATE TABLE IF NOT EXISTS stock_transfer_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transfer_id UUID REFERENCES stock_transfers(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    quantity INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE stock_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transfer_items ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$
BEGIN
    -- stock_locations
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Allow all for authenticated' AND tablename = 'stock_locations') THEN
        CREATE POLICY "Allow all for authenticated" ON stock_locations FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
    
    -- stock_transfers
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Enable all for all on stock_transfers') THEN
        CREATE POLICY "Enable all for all on stock_transfers" ON stock_transfers FOR ALL USING (true);
    END IF;

    -- stock_transfer_items
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Enable all for all on stock_transfer_items') THEN
        CREATE POLICY "Enable all for all on stock_transfer_items" ON stock_transfer_items FOR ALL USING (true);
    END IF;
END
$$;
