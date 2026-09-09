const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = Object.fromEntries(
    envFile.split('\n')
        .filter(line => line && !line.startsWith('#'))
        .map(line => {
            const idx = line.indexOf('=');
            if (idx === -1) return [line, ''];
            return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()];
        })
);

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
    console.error('Error: SUPABASE_SERVICE_ROLE_KEY not found in .env.local');
    console.log('Please add SUPABASE_SERVICE_ROLE_KEY to your .env.local file');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

const migrationSQL = `
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
`;

async function runMigration() {
    console.log('Running BOM enhancement migration...');
    
    try {
        // Use postgrest to execute raw SQL via rpc or direct approach
        // Since we can't execute raw SQL directly via PostgREST, let's try a different approach
        // We'll check if tables exist and add columns individually
        
        // Check and add columns to bill_of_materials
        const columnsToAdd = [
            { name: 'component_id', type: 'UUID' },
            { name: 'quantity_required', type: 'NUMERIC(15,3)' },
            { name: 'unit_cost', type: 'NUMERIC(15,2)' },
            { name: 'notes', type: 'TEXT' }
        ];
        
        console.log('Checking bill_of_materials table structure...');
        const { data: bomData, error: bomError } = await supabase
            .from('bill_of_materials')
            .select('*')
            .limit(1);
        
        if (bomError) {
            console.log('Error checking bill_of_materials:', bomError.message);
        } else {
            console.log('bill_of_materials table exists and is accessible');
            console.log('Sample data:', bomData);
        }
        
        // Check if bom_items table exists
        console.log('\nChecking bom_items table...');
        const { data: bomItemsData, error: bomItemsError } = await supabase
            .from('bom_items')
            .select('*')
            .limit(1);
        
        if (bomItemsError) {
            console.log('bom_items table does not exist or error:', bomItemsError.message);
            console.log('\nPlease run the following SQL manually in Supabase dashboard:');
            console.log('='.repeat(60));
            console.log(migrationSQL);
            console.log('='.repeat(60));
        } else {
            console.log('bom_items table exists and is accessible');
        }
        
        // Try to get list of finished products to verify products table
        console.log('\nVerifying products table...');
        const { data: products, error: productsError } = await supabase
            .from('products')
            .select('id, name, sku, material_type')
            .limit(5);
        
        if (productsError) {
            console.log('Error fetching products:', productsError.message);
        } else {
            console.log('Products table OK. Sample products:');
            console.log(products);
        }
        
        console.log('\n✓ Migration check complete');
        
    } catch (error) {
        console.error('Migration error:', error);
    }
}

runMigration();