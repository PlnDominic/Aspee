// Update unit to 'Grams' for PVC 152, PVC 174, PVC 184, PVC 78
// Run with: node apply_update_pvc_units.js

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

const PRODUCT_NAMES = ['PVC 152', 'PVC 174', 'PVC 184', 'PVC 78'];

async function run() {
    console.log('Updating PVC product units to Grams...\n');

    for (const name of PRODUCT_NAMES) {
        const { data: product, error: fetchErr } = await supabase
            .from('products')
            .select('id, name, unit')
            .ilike('name', name)
            .maybeSingle();

        if (fetchErr) {
            console.error(`  ERROR fetching "${name}":`, fetchErr.message);
            continue;
        }

        if (!product) {
            console.warn(`  NOT FOUND: "${name}"`);
            continue;
        }

        if (product.unit === 'Grams') {
            console.log(`  SKIP  "${product.name}" — already Grams`);
            continue;
        }

        const { error: updateErr } = await supabase
            .from('products')
            .update({ unit: 'Grams' })
            .eq('id', product.id);

        if (updateErr) {
            console.error(`  ERROR updating "${product.name}":`, updateErr.message);
        } else {
            console.log(`  OK    "${product.name}" — ${product.unit} → Grams`);
        }
    }

    // Verify
    console.log('\nVerification:');
    const { data: verified } = await supabase
        .from('products')
        .select('name, unit, sku')
        .or(PRODUCT_NAMES.map(n => `name.ilike.${n}`).join(','))
        .order('name');

    (verified || []).forEach(p => console.log(`  [${p.unit}] ${p.name} (${p.sku})`));
}

run().catch(console.error);
