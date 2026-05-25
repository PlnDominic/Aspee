const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Error: Missing Supabase credentials in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
    try {
        const migrationSQL = fs.readFileSync(
            './supabase/migrations/20260422000100_add_units_per_carton_to_products.sql',
            'utf8'
        );

        console.log('Adding units_per_carton and unit_label to products...');

        const statements = migrationSQL
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

        for (const statement of statements) {
            try {
                await supabase.rpc('exec_sql', { sql: statement });
                console.log('OK:', statement.slice(0, 60).replace(/\n/g, ' '));
            } catch (error) {
                console.warn('Skipped:', error.message);
            }
        }

        console.log('\nMigration completed!');
    } catch (error) {
        console.error('Migration failed:', error);
    }
}

runMigration();
