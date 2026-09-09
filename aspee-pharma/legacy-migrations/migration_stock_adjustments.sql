-- ASPEE PHARMACEUTICALS - STOCK ADJUSTMENTS: INTERNAL USE, MATERIAL DEFECTS, MATERIAL EXPIRY

-- 1. INTERNAL USE TABLE
CREATE TABLE IF NOT EXISTS stock_internal_use (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_number TEXT UNIQUE NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    product_id UUID REFERENCES products(id) ON DELETE RESTRICT,
    location_id UUID REFERENCES stock_locations(id) ON DELETE RESTRICT,
    quantity DECIMAL(12,3) NOT NULL CHECK (quantity > 0),
    purpose TEXT NOT NULL DEFAULT 'Office Use',
    notes TEXT,
    recorded_by UUID REFERENCES system_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. MATERIAL DEFECTS TABLE
CREATE TABLE IF NOT EXISTS stock_material_defects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_number TEXT UNIQUE NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    product_id UUID REFERENCES products(id) ON DELETE RESTRICT,
    location_id UUID REFERENCES stock_locations(id) ON DELETE RESTRICT,
    quantity DECIMAL(12,3) NOT NULL CHECK (quantity > 0),
    defect_type TEXT NOT NULL DEFAULT 'Breakage',
    batch_number TEXT,
    notes TEXT,
    recorded_by UUID REFERENCES system_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. MATERIAL EXPIRY TABLE
CREATE TABLE IF NOT EXISTS stock_material_expiry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_number TEXT UNIQUE NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    product_id UUID REFERENCES products(id) ON DELETE RESTRICT,
    location_id UUID REFERENCES stock_locations(id) ON DELETE RESTRICT,
    quantity DECIMAL(12,3) NOT NULL CHECK (quantity > 0),
    batch_number TEXT,
    expiry_date DATE,
    disposal_method TEXT NOT NULL DEFAULT 'Destroyed',
    notes TEXT,
    recorded_by UUID REFERENCES system_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. ENABLE RLS
ALTER TABLE stock_internal_use ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_material_defects ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_material_expiry ENABLE ROW LEVEL SECURITY;

-- 5. RLS POLICIES (authenticated users can read/insert/update/delete)
CREATE POLICY "Allow authenticated read internal_use" ON stock_internal_use FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert internal_use" ON stock_internal_use FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update internal_use" ON stock_internal_use FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete internal_use" ON stock_internal_use FOR DELETE TO authenticated USING (true);

CREATE POLICY "Allow authenticated read material_defects" ON stock_material_defects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert material_defects" ON stock_material_defects FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update material_defects" ON stock_material_defects FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete material_defects" ON stock_material_defects FOR DELETE TO authenticated USING (true);

CREATE POLICY "Allow authenticated read material_expiry" ON stock_material_expiry FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert material_expiry" ON stock_material_expiry FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update material_expiry" ON stock_material_expiry FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete material_expiry" ON stock_material_expiry FOR DELETE TO authenticated USING (true);
