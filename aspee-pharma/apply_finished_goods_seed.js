// Seed finished goods (syrups, tablets, capsules) with carton / bulk-pack ratios
// Run: node apply_finished_goods_seed.js

const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// [name, sku, unit, bulk_to_base_ratio, product_category]
// unit = base unit (Bottles for syrups, Skellets for tablets/capsules)
// bulk_unit = Cartons for all finished goods
// bulk_to_base_ratio = how many base units per carton

const SYRUPS = [
  ['ASPIDYNE SYRUP',                  'FG-SEED-001', 'Bottles', 30,  'Oral Liquid'],
  ['ASPITONE SYRUP',                  'FG-SEED-002', 'Bottles', 30,  'Oral Liquid'],
  ['HAEMATOSE SYRUP',                 'FG-SEED-003', 'Bottles', 30,  'Oral Liquid'],
  ['LISTA SYRUP',                     'FG-SEED-004', 'Bottles', 30,  'Oral Liquid'],
  ['ASPIMOL SYRUP',                   'FG-SEED-005', 'Bottles', 60,  'Oral Liquid'],
  ['ASPOCOF SYRUP',                   'FG-SEED-006', 'Bottles', 60,  'Oral Liquid'],
  ['KINDERCOF SYRUP',                 'FG-SEED-007', 'Bottles', 60,  'Oral Liquid'],
  ['KINDERVITE SYRUP',                'FG-SEED-008', 'Bottles', 60,  'Oral Liquid'],
  ['KINDERPLEX SYRUP',                'FG-SEED-009', 'Bottles', 60,  'Oral Liquid'],
  ['ADULTCOF SYRUP',                  'FG-SEED-010', 'Bottles', 60,  'Oral Liquid'],
  ['ASPROLEX F SYRUP',                'FG-SEED-011', 'Bottles', 60,  'Oral Liquid'],
  ['QUININE SYRUP',                   'FG-SEED-012', 'Bottles', 60,  'Oral Liquid'],
  ['CODACOF SYRUP',                   'FG-SEED-013', 'Bottles', 60,  'Oral Liquid'],
  ['NASAL DROP 0.5%',                 'FG-SEED-014', 'Bottles', 180, 'Other Products'],
  ['NASAL DROP 1%',                   'FG-SEED-015', 'Bottles', 180, 'Other Products'],
  ['ASPIDYNE (NO JACKET) SYRUP',      'FG-SEED-016', 'Bottles', 30,  'Oral Liquid'],
  ['ASPIMOL SYRUP (NO JACKET)',       'FG-SEED-017', 'Bottles', 60,  'Oral Liquid'],
  ['KINDERVITE SYRUP (NO JACKET)',    'FG-SEED-018', 'Bottles', 60,  'Oral Liquid'],
];

const TABLETS_CAPSULES = [
  ['ASCOLD TABLET',           'FG-SEED-019', 'Skellets', 24, 'Oral Solid'],
  ['FOLIC ACID TABLET',       'FG-SEED-020', 'Skellets', 24, 'Oral Solid'],
  ['ASPIMOL EXTRA TABLET',    'FG-SEED-021', 'Skellets', 24, 'Oral Solid'],
  ['ASPIMOL EXTRA CAPSULES',  'FG-SEED-022', 'Skellets', 24, 'Oral Solid'],
  ['ASPIMOL FORTE CAPSULES',  'FG-SEED-023', 'Skellets', 24, 'Oral Solid'],
  ['ASPIMOL PLUS TABLET',     'FG-SEED-024', 'Skellets', 24, 'Oral Solid'],
  ['MULTIVITE TABLET',        'FG-SEED-025', 'Skellets', 24, 'Oral Solid'],
  ['B CO TABLET',             'FG-SEED-026', 'Skellets', 24, 'Oral Solid'],
  ['DIAZEPAM 5MG TABLET',     'FG-SEED-027', 'Skellets', 24, 'Controlled Products'],
  ['DIAZEPAM 10MG TABLET',    'FG-SEED-028', 'Skellets', 24, 'Controlled Products'],
  ['ASPIDYNE CAPSULES',       'FG-SEED-029', 'Skellets', 18, 'Oral Solid'],
  ['ASPIMAK CAPSULES',        'FG-SEED-030', 'Skellets', 24, 'Oral Solid'],
  ['ASTRADOL TABLET',         'FG-SEED-031', 'Skellets', 24, 'Oral Solid'],
  ['HAEMATOSE CAPSULES',      'FG-SEED-032', 'Skellets', 24, 'Oral Solid'],
  // Added per user request
  ['Aspimol X Tablet',        'FG-SEED-033', 'Skellets', 24, 'Oral Solid'],
  ['Aspimol Plus Tablet',     'FG-SEED-034', 'Skellets', 24, 'Oral Solid'],
];

const ALL_PRODUCTS = [...SYRUPS, ...TABLETS_CAPSULES].map(
  ([name, sku, unit, bulk_to_base_ratio, product_category]) => ({
    name,
    sku,
    material_type: 'Finished Good',
    unit,
    bulk_unit: 'Cartons',
    bulk_to_base_ratio,
    product_category,
    reorder_level: 10,
  })
);

const PREREQ_SQL = `
-- Run this in Supabase Dashboard → SQL Editor if you see column-not-found errors
ALTER TABLE products ADD COLUMN IF NOT EXISTS bulk_unit TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS bulk_to_base_ratio NUMERIC(12,4) DEFAULT 1;
ALTER TABLE products ADD COLUMN IF NOT EXISTS purchase_unit TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS issue_unit TEXT;
`;

async function main() {
  console.log('=== ASPEE PHARMA — Finished Goods Seed ===\n');

  // Probe for required columns before inserting
  const { error: probeError } = await supabase
    .from('products')
    .select('bulk_unit, bulk_to_base_ratio')
    .limit(1);

  if (probeError && (probeError.message.includes('bulk_unit') || probeError.message.includes('bulk_to_base_ratio'))) {
    console.log('⚠️  Missing columns. Run this SQL in Supabase Dashboard → SQL Editor first:\n');
    console.log('─'.repeat(60));
    console.log(PREREQ_SQL);
    console.log('─'.repeat(60));
    console.log('\nThen re-run: node apply_finished_goods_seed.js');
    process.exit(0);
  }

  const { data: existing, error: fetchError } = await supabase
    .from('products')
    .select('name')
    .eq('material_type', 'Finished Good');

  if (fetchError) {
    console.error('Failed to fetch existing products:', fetchError.message);
    process.exit(1);
  }

  const existingNames = new Set((existing || []).map(p => p.name));
  const toInsert = ALL_PRODUCTS.filter(p => !existingNames.has(p.name));

  if (toInsert.length === 0) {
    console.log('All 32 finished goods already exist — nothing to insert.');
    process.exit(0);
  }

  console.log(`Inserting ${toInsert.length} new finished good(s)...`);

  const { error: insertError } = await supabase.from('products').insert(toInsert);

  if (insertError) {
    console.error('Insert failed:', insertError.message);
    process.exit(1);
  }

  const { count } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('material_type', 'Finished Good');

  console.log(`✅ Done. Total finished goods in DB: ${count}`);
  console.log('\nSyrups seeded with unit=Bottles, bulk_unit=Cartons.');
  console.log('Tablets/Capsules seeded with unit=Skellets, bulk_unit=Cartons.');
  console.log('Note: KINDERVITE SYRUP9NO JACKET) corrected to KINDERVITE SYRUP (NO JACKET).');
}

main().catch(err => {
  console.error('\n❌ Unexpected error:', err.message);
  process.exit(1);
});
