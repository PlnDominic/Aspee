-- ASPEE PHARMACEUTICALS - SALES CUSTOMER ENHANCEMENTS
-- Add fields for customer categorization, route assignment, and sales person tracking

-- Add customer category field with validation
ALTER TABLE customers ADD COLUMN IF NOT EXISTS category TEXT 
    CHECK (category IN ('OTC', 'WHOLESALE PHARMACY', 'RETAIL PHARMACY', 'CLINIC', 'HOSPITAL', 'MEDICAL STORES'));

-- Add route assignment (links to vans table which represents routes)
ALTER TABLE customers ADD COLUMN IF NOT EXISTS route_id UUID REFERENCES vans(id) ON DELETE SET NULL;

-- Add sales person assignment (links to profiles/users)
ALTER TABLE customers ADD COLUMN IF NOT EXISTS sales_person_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Add specific location field for better geographic tracking
ALTER TABLE customers ADD COLUMN IF NOT EXISTS location TEXT;

-- Add index for performance on frequently queried fields
CREATE INDEX IF NOT EXISTS idx_customers_category ON customers(category);
CREATE INDEX IF NOT EXISTS idx_customers_route_id ON customers(route_id);
CREATE INDEX IF NOT EXISTS idx_customers_sales_person_id ON customers(sales_person_id);

-- Create view for easy customer summary with all relationships
CREATE OR REPLACE VIEW customer_summary AS
SELECT 
    c.id,
    c.name,
    c.category,
    c.contact_person,
    c.email,
    c.phone,
    c.address,
    c.location,
    c.status,
    c.credit_limit,
    c.balance,
    v.name as route_name,
    v.van_id as route_code,
    p.name as sales_person_name,
    p.email as sales_person_email,
    c.created_at,
    c.updated_at
FROM customers c
LEFT JOIN vans v ON c.route_id = v.id
LEFT JOIN profiles p ON c.sales_person_id = p.id;

-- Enable RLS for the new columns (existing RLS policies will cover these)
-- If no RLS exists yet, add basic policies
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'customers') THEN
        ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
        
        CREATE POLICY "Enable read access for all users" ON customers FOR SELECT USING (true);
        
        CREATE POLICY "Enable insert for authenticated users" ON customers FOR INSERT 
            WITH CHECK (auth.uid() IS NOT NULL);
            
        CREATE POLICY "Enable update for authenticated users" ON customers FOR UPDATE 
            USING (auth.uid() IS NOT NULL);
    END IF;
END $$;

COMMENT ON COLUMN customers.category IS 'Customer category: OTC, WHOLESALE PHARMACY, RETAIL PHARMACY, CLINIC, HOSPITAL, MEDICAL STORES';
COMMENT ON COLUMN customers.route_id IS 'Foreign key linking customer to a van/route';
COMMENT ON COLUMN customers.sales_person_id IS 'Foreign key linking customer to a sales person (profile)';
COMMENT ON COLUMN customers.location IS 'Specific geographic location or area of the customer';
