-- BOM Enhancement: Add component tracking columns
-- Ensures bill_of_materials has all required columns for proper BOM functionality

-- 1. Add component tracking columns if they don't exist
ALTER TABLE bill_of_materials ADD COLUMN IF NOT EXISTS component_id UUID REFERENCES products(id);
ALTER TABLE bill_of_materials ADD COLUMN IF NOT EXISTS quantity_required NUMERIC(15,3) DEFAULT 0;
ALTER TABLE bill_of_materials ADD COLUMN IF NOT EXISTS unit_cost NUMERIC(15,2) DEFAULT 0;
ALTER TABLE bill_of_materials ADD COLUMN IF NOT EXISTS notes TEXT;

-- 2. Create BOM line items table for multi-component BOMs
CREATE TABLE IF NOT EXISTS bom_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bom_id UUID REFERENCES bill_of_materials(id) ON DELETE CASCADE,
    component_id UUID REFERENCES products(id),
    quantity_required NUMERIC(15,3) NOT NULL DEFAULT 0,
    unit_ratio NUMERIC(15,6) DEFAULT 1,
    notes TEXT,
    position INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Enable RLS
ALTER TABLE bom_items ENABLE ROW LEVEL SECURITY;

-- 4. Create policies for bom_items
DROP POLICY IF EXISTS "Enable all for all on bom_items" ON bom_items;
DROP POLICY IF EXISTS "Allow app select on bom_items" ON bom_items;
DROP POLICY IF EXISTS "Allow app insert on bom_items" ON bom_items;
DROP POLICY IF EXISTS "Allow app update on bom_items" ON bom_items;
DROP POLICY IF EXISTS "Allow app delete on bom_items" ON bom_items;

CREATE POLICY "Allow app select on bom_items"
    ON bom_items FOR SELECT
    TO anon, authenticated
    USING (true);

CREATE POLICY "Allow app insert on bom_items"
    ON bom_items FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

CREATE POLICY "Allow app update on bom_items"
    ON bom_items FOR UPDATE
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow app delete on bom_items"
    ON bom_items FOR DELETE
    TO anon, authenticated
    USING (true);

-- 5. Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_bom_items_bom_id ON bom_items(bom_id);
CREATE INDEX IF NOT EXISTS idx_bom_items_component_id ON bom_items(component_id);
CREATE INDEX IF NOT EXISTS idx_bill_of_materials_finished_product ON bill_of_materials(finished_product_id);
