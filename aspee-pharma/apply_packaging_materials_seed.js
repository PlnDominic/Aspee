// Seed packaging materials
// Run: node apply_packaging_materials_seed.js

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

// [name, sku, unit]
// Packaging materials have no purchase_unit/issue_unit conversion — stock is tracked in Pieces or Bottles
const PACKAGING_MATERIALS = [
  // ── Labels / Outers / Cartons ────────────────────────────────────
  ['Astradol Inners',                 'PM-SEED-001', 'Pieces'],
  ['Astradol Outers',                 'PM-SEED-002', 'Pieces'],
  ['Aspimol Forte Cartons',           'PM-SEED-003', 'Pieces'],
  ['Ascold Cartons',                  'PM-SEED-004', 'Pieces'],
  ['Ascold Catch Covers',             'PM-SEED-005', 'Pieces'],
  // ── Bottles / Containers ─────────────────────────────────────────
  ['Nasal Drop Bottles',              'PM-SEED-006', 'Bottles'],
  ['200ml Aluminium Cups',            'PM-SEED-007', 'Pieces'],
  // ── Capsule Shells ───────────────────────────────────────────────
  ['Aspimol Forte Shells',            'PM-SEED-008', 'Pieces'],
  ['Aspimak Shells',                  'PM-SEED-009', 'Pieces'],
  ['Aspimol Extra Capsules Shells',   'PM-SEED-010', 'Pieces'],
  ['Haematose Capsules Shells',       'PM-SEED-011', 'Pieces'],
  ['Aspidyne Capsule Shells',         'PM-SEED-012', 'Pieces'],
].map(([name, sku, unit]) => ({
  name,
  sku,
  material_type: 'Packaging Material',
  unit,
  reorder_level: 10,
  product_category: 'Other Products',
}));

async function main() {
  console.log('=== ASPEE PHARMA — Packaging Materials Seed ===\n');

  const { data: existing, error: fetchError } = await supabase
    .from('products')
    .select('name')
    .eq('material_type', 'Packaging Material');

  if (fetchError) {
    console.error('Failed to fetch existing products:', fetchError.message);
    process.exit(1);
  }

  const existingNames = new Set((existing || []).map(p => p.name));
  const toInsert = PACKAGING_MATERIALS.filter(p => !existingNames.has(p.name));

  if (toInsert.length === 0) {
    console.log('All 12 packaging materials already exist — nothing to insert.');
    process.exit(0);
  }

  console.log(`Inserting ${toInsert.length} packaging material(s)...`);

  const { error } = await supabase.from('products').insert(toInsert);
  if (error) {
    console.error('Insert failed:', error.message);
    process.exit(1);
  }

  const { count } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('material_type', 'Packaging Material');

  console.log(`✅ Done. Total packaging materials in DB: ${count}`);
}

main().catch(err => {
  console.error('\n❌ Unexpected error:', err.message);
  process.exit(1);
});
