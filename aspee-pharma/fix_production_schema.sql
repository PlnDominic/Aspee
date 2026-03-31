-- ASPEE PHARMACEUTICALS - DATABASE ALIGNMENT FOR PRODUCTION & INV
-- This script aligns the schema with the actual code expectations

-- 1. FIX PRODUCTION ORDERS
-- Add missing columns if they don't exist
ALTER TABLE production_orders ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id);
ALTER TABLE production_orders ADD COLUMN IF NOT EXISTS bom_version TEXT DEFAULT '1.0';
ALTER TABLE production_orders ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE production_orders ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE production_orders ADD COLUMN IF NOT EXISTS quantity INTEGER;

-- 2. ALIGN BOM TABLE NAMES (Code uses bill_of_materials)
-- Check if bill_of_materials exists, if not create it or rename boms
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'bill_of_materials') THEN
        IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'boms') THEN
            ALTER TABLE boms RENAME TO bill_of_materials;
        ELSE
            CREATE TABLE bill_of_materials (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                finished_product_id UUID REFERENCES products(id),
                name TEXT,
                version TEXT DEFAULT '1.0',
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
        END IF;
    END IF;
END $$;

-- 3. ENSURE PRODUCTION ORDER ITEMS
CREATE TABLE IF NOT EXISTS production_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES production_orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    quantity_required INTEGER,
    quantity_used INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. ENABLE RLS & POLICIES
ALTER TABLE bill_of_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_order_items ENABLE ROW LEVEL SECURITY;

-- Idempotent policy creation
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Enable all for all on bill_of_materials') THEN
        CREATE POLICY "Enable all for all on bill_of_materials" ON bill_of_materials FOR ALL USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Enable all for all on production_order_items') THEN
        CREATE POLICY "Enable all for all on production_order_items" ON production_order_items FOR ALL USING (true);
    END IF;
END $$;
