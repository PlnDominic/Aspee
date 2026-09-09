// Seed raw materials (83 items — official updated alphabetical list)
// Run: node apply_raw_material_units.js
//
// If columns are missing, script prints the SQL to run in Supabase Dashboard first.
// Deletes all previous RM-SEED-* rows before re-inserting to keep the list authoritative.

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

const PREREQ_SQL = `
-- Run in Supabase Dashboard → SQL Editor if you see column-not-found errors
ALTER TABLE products ADD COLUMN IF NOT EXISTS purchase_unit TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS issue_unit TEXT;
`;

// unit       = stock tracking / issue unit
// purchaseU  = purchase order unit
// [name, sku, unit, purchaseU]
//
// Patterns:
//   KG → G  : unit='Grams',       purchaseU='Kilograms'
//   LTR → L : unit='Litres',      purchaseU='Litres'       (Anise Oil, Caramel, Chocolate, Condensed Milk)
//   LTR → ML: unit='Millilitres', purchaseU='Litres'       (solvents, most flavours, liquid excipients)

const G = ['Grams', 'Kilograms'];
const L = ['Litres', 'Litres'];
const ML = ['Millilitres', 'Litres'];

const RAW_MATERIALS = [
  // ── A ──────────────────────────────────────────────────────────────
  ['Aerosil',                     'RM-SEED-001', ...G],
  ['Amaranth Red',                'RM-SEED-002', ...G],
  ['Ammonium Chloride',           'RM-SEED-003', ...G],
  ['Anise Oil',                   'RM-SEED-004', ...L],
  ['Ascorbic Acid',               'RM-SEED-005', ...G],
  ['Aspartame',                   'RM-SEED-006', ...G],
  // ── B ──────────────────────────────────────────────────────────────
  ['Bee Wax',                     'RM-SEED-007', ...G],
  ['Benzoic Acid',                'RM-SEED-008', ...G],
  ['Brilliant Blue',              'RM-SEED-009', ...G],
  ['Bromhexine',                  'RM-SEED-010', ...G],
  // ── C ──────────────────────────────────────────────────────────────
  ['Caffeine Anhydrous',          'RM-SEED-011', ...G],
  ['Canuaba Wax',                 'RM-SEED-012', ...G],
  ['Caramel',                     'RM-SEED-013', ...L],
  ['Carboxymethyl Cellulose',     'RM-SEED-014', ...G],
  ['Chlorbutanol',                'RM-SEED-015', ...G],
  ['Chloroform',                  'RM-SEED-016', ...ML],
  ['Chlorpheniramine',            'RM-SEED-017', ...G],
  ['Chocolate Flavour',           'RM-SEED-018', ...L],
  ['Citric Acid',                 'RM-SEED-019', ...G],
  ['Condensed Milk Flavour',      'RM-SEED-020', ...L],
  ['Cyproheptadine',              'RM-SEED-021', ...G],
  // ── D ──────────────────────────────────────────────────────────────
  ['D-Calcium Pantothenate',      'RM-SEED-022', ...G],
  ['Diaphenhydramine',            'RM-SEED-023', ...G],
  ['Diazepam',                    'RM-SEED-024', ...G],
  ['Di-Calcium Phosphate',        'RM-SEED-025', ...G],
  ['Diclofenac Sodium',           'RM-SEED-026', ...G],
  ['Dicyclomine',                 'RM-SEED-027', ...G],
  // ── E ──────────────────────────────────────────────────────────────
  ['Egg Yellow',                  'RM-SEED-028', ...G],
  ['Ephedrine',                   'RM-SEED-029', ...G],
  ['Ethanol',                     'RM-SEED-030', ...ML],
  // ── F ──────────────────────────────────────────────────────────────
  ['Ferric Ammonium Citrate',     'RM-SEED-031', ...G],
  ['Folic Acid',                  'RM-SEED-032', ...G],
  ['Furazolidone',                'RM-SEED-033', ...G],
  // ── G ──────────────────────────────────────────────────────────────
  ['Gelatin',                     'RM-SEED-034', ...G],
  ['Glycerine',                   'RM-SEED-035', ...ML],
  ['Guaiphenesin',                'RM-SEED-036', ...G],
  // ── H ──────────────────────────────────────────────────────────────
  ['Honey',                       'RM-SEED-037', ...ML],
  // ── I ──────────────────────────────────────────────────────────────
  ['Ibuprofen',                   'RM-SEED-038', ...G],
  ['Iron III Polymatose',         'RM-SEED-039', ...G],
  // ── L ──────────────────────────────────────────────────────────────
  ['Lactose',                     'RM-SEED-040', ...G],
  ['Lemon Flavour',               'RM-SEED-041', ...ML],
  ['L-Lysine',                    'RM-SEED-042', ...G],
  // ── M ──────────────────────────────────────────────────────────────
  ['Magnesium Stearate',          'RM-SEED-043', ...G],
  ['Maize Starch',                'RM-SEED-044', ...G],
  ['Mefenamic Acid',              'RM-SEED-045', ...G],
  ['Menthol',                     'RM-SEED-046', ...G],
  ['Metronidazole',               'RM-SEED-047', ...G],
  ['Microcrystalline Cellulose',  'RM-SEED-048', ...G],
  // ── N ──────────────────────────────────────────────────────────────
  ['Nicotinamide',                'RM-SEED-049', ...G],
  // ── O ──────────────────────────────────────────────────────────────
  ['Orange Emulsion',             'RM-SEED-050', ...ML],
  ['Orange Flavour',              'RM-SEED-051', ...ML],
  // ── P ──────────────────────────────────────────────────────────────
  ['Paracetamol',                 'RM-SEED-052', ...G],
  ['Peppermint Oil',              'RM-SEED-053', ...ML],
  ['Pineapple Flavour',           'RM-SEED-054', ...ML],
  ['Ponceau 4R',                  'RM-SEED-055', ...G],
  ['Propylene Glycol',            'RM-SEED-056', ...ML],
  ['Purified Talc Powder',        'RM-SEED-057', ...G],
  ['Pyridoxine HCL',              'RM-SEED-058', ...G],
  // ── Q ──────────────────────────────────────────────────────────────
  ['Quinine Sulphate',            'RM-SEED-059', ...G],
  // ── R ──────────────────────────────────────────────────────────────
  ['Raspberry Flavour',           'RM-SEED-060', ...ML],
  ['Riboflavin',                  'RM-SEED-061', ...G],
  // ── S ──────────────────────────────────────────────────────────────
  ['Shellac',                     'RM-SEED-062', ...G],
  ['Sodium Chloride',             'RM-SEED-063', ...G],
  ['Sodium Citrate',              'RM-SEED-064', ...G],
  ['Sodium Lauryl Sulphate',      'RM-SEED-065', ...G],
  ['Sodium Saccharin',            'RM-SEED-066', ...G],
  ['Sodium Starch Glycolate',     'RM-SEED-067', ...G],
  ['Strawberry Emulsion',         'RM-SEED-068', ...ML],
  ['Strawberry Flavour',          'RM-SEED-069', ...ML],
  ['Sugar',                       'RM-SEED-070', ...G],
  // ── T ──────────────────────────────────────────────────────────────
  ['Tetrazine Yellow',            'RM-SEED-071', ...G],
  ['Thiamine Hydrochloride',      'RM-SEED-072', ...G],
  ['Thiamine Monohydrate',        'RM-SEED-073', ...G],
  ['Titanium Dioxide',            'RM-SEED-074', ...G],
  ['Tramadol',                    'RM-SEED-075', ...G],
  ['Tween 80',                    'RM-SEED-076', ...ML],
  // ── V ──────────────────────────────────────────────────────────────
  ['Vanilla Flavour',             'RM-SEED-077', ...ML],
  ['Vitamin A Acetate',           'RM-SEED-078', ...G],
  ['Vitamin A Palmitate',         'RM-SEED-079', ...G],
  ['Vitamin B12',                 'RM-SEED-080', ...G],
  ['Vitamin D3',                  'RM-SEED-081', ...ML],
  // ── X / Z ──────────────────────────────────────────────────────────
  ['Xanthan Gum',                 'RM-SEED-082', ...G],
  ['Zinc Sulphate',               'RM-SEED-083', ...G],
].map(([name, sku, unit, purchase_unit]) => ({
  name,
  sku,
  material_type: 'Raw Material',
  unit,
  purchase_unit,
  issue_unit: unit,
  reorder_level: 10,
  product_category: 'Other Products',
}));

async function main() {
  console.log('=== ASPEE PHARMA — Raw Materials Seed (Updated List) ===\n');

  // Column existence check
  const { error: probeError } = await supabase
    .from('products')
    .select('purchase_unit, issue_unit')
    .limit(1);

  if (probeError && probeError.message.includes('purchase_unit')) {
    console.log('⚠️  Missing columns. Run this SQL in Supabase Dashboard → SQL Editor first:\n');
    console.log('─'.repeat(60));
    console.log(PREREQ_SQL);
    console.log('─'.repeat(60));
    console.log('\nThen re-run: node apply_raw_material_units.js');
    process.exit(0);
  }

  // Delete previous seeds so the list stays authoritative
  console.log('Removing previous RM-SEED-* rows...');
  const { error: deleteError } = await supabase
    .from('products')
    .delete()
    .like('sku', 'RM-SEED-%');

  if (deleteError) {
    console.error('Delete failed:', deleteError.message);
    process.exit(1);
  }
  console.log('✅ Old seeds cleared\n');

  // Insert in batches of 20 to stay within PostgREST limits
  const BATCH = 20;
  let inserted = 0;
  for (let i = 0; i < RAW_MATERIALS.length; i += BATCH) {
    const batch = RAW_MATERIALS.slice(i, i + BATCH);
    const { error } = await supabase.from('products').insert(batch);
    if (error) {
      console.error(`Insert failed at batch ${i}–${i + BATCH}:`, error.message);
      process.exit(1);
    }
    inserted += batch.length;
    console.log(`  Inserted ${inserted}/${RAW_MATERIALS.length}...`);
  }

  const { count } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('material_type', 'Raw Material');

  console.log(`\n✅ Done. Total raw materials in DB: ${count}`);
  console.log('\nUnit breakdown:');
  console.log('  KG → G  (solids):  63 items');
  console.log('  LTR → L (liquids):  4 items  (Anise Oil, Caramel, Chocolate Flavour, Condensed Milk Flavour)');
  console.log('  LTR → mL(liquids): 16 items  (solvents, most flavours, liquid excipients)');
}

main().catch(err => {
  console.error('\n❌ Unexpected error:', err.message);
  process.exit(1);
});
