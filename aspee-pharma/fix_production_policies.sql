-- ASPEE PHARMACEUTICALS - PRODUCTION POLICIES FIX
-- This script adds the missing RLS policies for production-related tables to fix the "new row violates row-level security policy" error.

DO $$
BEGIN
    -- 1. Production Orders
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'production_orders') THEN
        ALTER TABLE production_orders ENABLE ROW LEVEL SECURITY;
        IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Enable all for all on production_orders') THEN
            CREATE POLICY "Enable all for all on production_orders" ON production_orders FOR ALL USING (true);
        END IF;
    END IF;

    -- 2. Production Order Items
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'production_order_items') THEN
        ALTER TABLE production_order_items ENABLE ROW LEVEL SECURITY;
        IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Enable all for all on production_order_items') THEN
            CREATE POLICY "Enable all for all on production_order_items" ON production_order_items FOR ALL USING (true);
        END IF;
    END IF;

    -- 3. Bill of Materials
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'bill_of_materials') THEN
        ALTER TABLE bill_of_materials ENABLE ROW LEVEL SECURITY;
        IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Enable all for all on bill_of_materials') THEN
            CREATE POLICY "Enable all for all on bill_of_materials" ON bill_of_materials FOR ALL USING (true);
        END IF;
    END IF;

    -- 4. Material Requests
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'material_requests') THEN
        ALTER TABLE material_requests ENABLE ROW LEVEL SECURITY;
        IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Enable all for all on material_requests') THEN
            CREATE POLICY "Enable all for all on material_requests" ON material_requests FOR ALL USING (true);
        END IF;
    END IF;

    -- 5. Material Request Items
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'material_request_items') THEN
        ALTER TABLE material_request_items ENABLE ROW LEVEL SECURITY;
        IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Enable all for all on material_request_items') THEN
            CREATE POLICY "Enable all for all on material_request_items" ON material_request_items FOR ALL USING (true);
        END IF;
    END IF;
END $$;
