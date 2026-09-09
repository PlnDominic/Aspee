// Seed all core stock locations (Main Warehouse, Production Floor, etc.)
// Run with: node apply_seed_all_locations.js

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

const LOCATIONS = [
    { name: 'Main Warehouse',       type: 'Warehouse'   },
    { name: 'Finished Goods Store', type: 'Warehouse'   },
    { name: 'Packaging Store',      type: 'Warehouse'   },
    { name: 'Quarantine Store',     type: 'Quarantine'  },
    { name: 'Production Floor',     type: 'Production'  },
    { name: 'Sales Department',     type: 'Sales'       },
];

async function run() {
    console.log('Seeding stock locations...\n');

    let inserted = 0;
    let skipped  = 0;

    for (const loc of LOCATIONS) {
        // Check if it already exists
        const { data: existing } = await supabase
            .from('stock_locations')
            .select('id')
            .eq('name', loc.name)
            .maybeSingle();

        if (existing) {
            console.log(`  SKIP  [${loc.type}] ${loc.name}`);
            skipped++;
            continue;
        }

        const { error } = await supabase
            .from('stock_locations')
            .insert({ name: loc.name, type: loc.type });

        if (error) {
            console.error(`  ERROR [${loc.type}] ${loc.name}:`, error.message);
        } else {
            console.log(`  OK    [${loc.type}] ${loc.name}`);
            inserted++;
        }
    }

    console.log(`\nDone — ${inserted} inserted, ${skipped} already existed.`);

    // Print current locations
    const { data: all } = await supabase
        .from('stock_locations')
        .select('name, type')
        .order('type')
        .order('name');

    console.log('\nAll locations now in database:');
    (all || []).forEach(l => console.log(`  [${l.type}] ${l.name}`));
}

run().catch(console.error);
