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

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
});

function makeSku(name) {
    const abbr = name
        .replace(/[^A-Za-z0-9\s]/g, '')
        .split(/\s+/)
        .map(w => w.slice(0, 3).toUpperCase())
        .join('')
        .slice(0, 8);
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `FG-${abbr}-${rand}`;
}

// Columns confirmed in DB: name, sku, material_type, unit, reorder_level, is_controlled_drug, description
const products = [
    // ── Oral Liquids ──────────────────────────────────────────────────────────
    { name: 'Aspitone Syrup',          unit: 'Bottles',  is_controlled_drug: false, description: 'Oral Liquid' },
    { name: 'Aspimol Syrup',           unit: 'Bottles',  is_controlled_drug: false, description: 'Oral Liquid' },
    { name: 'Kinderplex Syrup',        unit: 'Bottles',  is_controlled_drug: false, description: 'Oral Liquid' },
    { name: 'Kindervite Syrup',        unit: 'Bottles',  is_controlled_drug: false, description: 'Oral Liquid' },
    { name: 'Adult-Cof Syrup',         unit: 'Bottles',  is_controlled_drug: false, description: 'Oral Liquid' },
    { name: 'Kinder-Cof Syrup',        unit: 'Bottles',  is_controlled_drug: false, description: 'Oral Liquid' },
    { name: 'Aspi-Cof Syrup',          unit: 'Bottles',  is_controlled_drug: false, description: 'Oral Liquid' },
    { name: 'Aspidyne Syrup',          unit: 'Bottles',  is_controlled_drug: false, description: 'Oral Liquid' },
    { name: 'Asprolex-F Syrup',        unit: 'Bottles',  is_controlled_drug: false, description: 'Oral Liquid' },
    { name: 'Haematose Syrup',         unit: 'Bottles',  is_controlled_drug: false, description: 'Oral Liquid' },
    { name: 'Quinine Syrup',           unit: 'Bottles',  is_controlled_drug: false, description: 'Oral Liquid' },
    { name: 'Lista Syrup',             unit: 'Bottles',  is_controlled_drug: false, description: 'Oral Liquid' },
    { name: 'Coda-Cof Syrup',          unit: 'Bottles',  is_controlled_drug: false, description: 'Oral Liquid' },
    { name: 'Nasal Drop 0.5%',         unit: 'Bottles',  is_controlled_drug: false, description: 'Oral Liquid' },
    { name: 'Nasal Drop 1%',           unit: 'Bottles',  is_controlled_drug: false, description: 'Oral Liquid' },
    // ── Tablets ───────────────────────────────────────────────────────────────
    { name: 'Ascap Tablets',           unit: 'Tablets',  is_controlled_drug: false, description: 'Oral Solid' },
    { name: 'Ascold Tablets',          unit: 'Tablets',  is_controlled_drug: false, description: 'Oral Solid' },
    { name: 'Folic Acid Tablets',      unit: 'Tablets',  is_controlled_drug: false, description: 'Oral Solid' },
    { name: 'Multivite Tablets',       unit: 'Tablets',  is_controlled_drug: false, description: 'Oral Solid' },
    { name: 'Aspimol-X Tablets',       unit: 'Tablets',  is_controlled_drug: false, description: 'Oral Solid' },
    { name: 'Aspimol Plus Tablets',    unit: 'Tablets',  is_controlled_drug: false, description: 'Oral Solid' },
    { name: 'Astradol Tablets',        unit: 'Tablets',  is_controlled_drug: false, description: 'Oral Solid' },
    { name: 'Aspimol Extra Tablets',   unit: 'Tablets',  is_controlled_drug: false, description: 'Oral Solid' },
    { name: 'B-Co Tablets',            unit: 'Tablets',  is_controlled_drug: false, description: 'Oral Solid' },
    { name: 'Diazepam 5mg Tablets',    unit: 'Tablets',  is_controlled_drug: true,  description: 'Controlled Product' },
    { name: 'Diazepam 10mg Tablets',   unit: 'Tablets',  is_controlled_drug: true,  description: 'Controlled Product' },
    { name: 'D-5mg Loose',             unit: 'Tablets',  is_controlled_drug: true,  description: 'Controlled Product' },
    // ── Capsules ──────────────────────────────────────────────────────────────
    { name: 'Aspimol Forte Capsules',  unit: 'Capsules', is_controlled_drug: false, description: 'Oral Solid' },
    { name: 'Aspidyne Capsules',       unit: 'Capsules', is_controlled_drug: false, description: 'Oral Solid' },
    { name: 'Aspimol Extra Capsules',  unit: 'Capsules', is_controlled_drug: false, description: 'Oral Solid' },
    { name: 'Aspimak Capsules',        unit: 'Capsules', is_controlled_drug: false, description: 'Oral Solid' },
    { name: 'Haematose Capsules',      unit: 'Capsules', is_controlled_drug: false, description: 'Oral Solid' },
    { name: 'Prostavite',              unit: 'Capsules', is_controlled_drug: false, description: 'Oral Solid' },
    { name: 'Simepi',                  unit: 'Capsules', is_controlled_drug: false, description: 'Oral Solid' },
];

async function seed() {
    console.log('Fetching existing finished goods to avoid duplicates...');
    const { data: existing } = await supabase
        .from('products')
        .select('name')
        .eq('material_type', 'Finished Good');

    const existingNames = new Set((existing || []).map(p => p.name.toLowerCase()));
    const toInsert = products.filter(p => !existingNames.has(p.name.toLowerCase()));

    if (toInsert.length === 0) {
        console.log('✓ All products already exist — nothing to insert.');
        return;
    }

    console.log(`Inserting ${toInsert.length} new products (${products.length - toInsert.length} already exist)...`);

    const rows = toInsert.map(p => ({
        name: p.name,
        sku: makeSku(p.name),
        material_type: 'Finished Good',
        unit: p.unit,
        is_controlled_drug: p.is_controlled_drug,
        description: p.description,
        reorder_level: 100,
    }));

    const { data, error } = await supabase.from('products').insert(rows).select('name, sku');
    if (error) {
        console.error('Insert error:', error.message);
        process.exit(1);
    }

    console.log('\n✓ Inserted successfully:');
    data.forEach(p => console.log(`  ${p.name.padEnd(35)} ${p.sku}`));
    console.log(`\nTotal inserted: ${data.length}`);
}

seed();
