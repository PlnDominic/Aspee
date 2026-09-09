// Apply official Aspee Pharmaceuticals price list + bulk conversions to all finished goods.
// Source: APPROVED NEW PRICE LIST + FINISHED GOODS conversion document.
// Run: node apply_official_prices_and_bulk.js
// Run: node apply_official_prices_and_bulk.js --dry-run   (preview only)

const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

const DRY_RUN = process.argv.includes('--dry-run');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// ─── Normalize product names for matching ─────────────────────────────────
// Handles:  "Kinder-Cof Syrup" ↔ "KINDERCOF SYRUP"
//           "Aspimol Extra Tablets" ↔ "ASPIMOL EXTRA TABS"
//           "Aspimol Forte Capsules" ↔ "ASPIMOL FORTE CAPS"
function normalize(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')     // strip spaces, hyphens, %, parens, dashes
    .replace(/tablets/g, 'tab')
    .replace(/tablet/g, 'tab')
    .replace(/capsules/g, 'cap')
    .replace(/capsule/g, 'cap')
    .replace(/caplets/g, 'cap')
    .replace(/caplet/g, 'cap')
    .replace(/tabs/g, 'tab')
    .replace(/caps/g, 'cap')
    .replace(/drops/g, 'drop');
}

// Manual aliases: price-list name → DB normalized key
// Used when product names differ too much for automatic matching.
const MANUAL_ALIASES = {
  // ASTRADOL – P CAPLETS  (price list)  ↔  Astradol Tablets (DB)
  [normalize('ASTRADOL P CAPLETS')]: normalize('Astradol Tablets'),
  // ASPICOF SYRUP (price list)  ↔  Aspi-Cof Syrup (DB)
  // (auto-matches after hyphen removal — alias here as safety net)
  [normalize('ASPICOF SYRUP')]: normalize('Aspi-Cof Syrup'),
};

// ─── Authoritative price + conversion table ───────────────────────────────
// [pricelist_name, cash_price, credit_price, pack_size, base_unit]
// pack_size = how many base_units per carton → goes into bulk_to_base_ratio
// All bulk_unit = 'Cartons'
// credit_price = null means no credit pricing

const OFFICIAL = [
  // ORAL LIQUIDS ─────────────────────────────────────────────────────────
  ['ASPIMOL SYRUP',         7.00, 8.00,  60,  'Bottles'],
  ['KINDERCOF SYRUP',       9.00, 11.00, 60,  'Bottles'],
  ['ASPROLEX F SYRUP',     10.00, 12.00, 60,  'Bottles'],
  ['ASPICOF SYRUP',         8.00, 10.00, 60,  'Bottles'],
  ['CODACOF SYRUP',        12.00, 14.00, 60,  'Bottles'],
  ['ADULTCOF SYRUP',       10.00, 12.00, 60,  'Bottles'],
  ['QUININE SYRUP',         7.00,  9.00, 60,  'Bottles'],
  ['KINDERVITE SYRUP',      8.00, 10.00, 60,  'Bottles'],
  ['ASPITONE SYRUP',       14.00, 16.00, 30,  'Bottles'],
  ['ASPIDYNE SYRUP',       14.00, 16.00, 30,  'Bottles'],
  ['HAEMATOSE SYRUP',      15.00, 17.00, 30,  'Bottles'],
  ['LISTA SYRUP',          14.00, 16.00, 30,  'Bottles'],
  ['KINDERPLEX SYRUP',      8.00, 10.00, 60,  'Bottles'],
  ['NASAL DROP 1%',         5.00,  6.00, 180, 'Bottles'],
  ['NASAL DROP 0.5%',       5.00,  6.00, 180, 'Bottles'],

  // ORAL SOLIDS ──────────────────────────────────────────────────────────
  ['DIAZEPAM 10MG TABS',   37.00, 40.00, 24, 'Skellets'],
  ['DIAZEPAM 5MG TABS',    33.00, 35.00, 24, 'Skellets'],
  ['FOLIC ACID TABS',      32.00, 34.00, 24, 'Skellets'],
  ['ASPIMOL FORTE CAPS',   65.00, 70.00, 24, 'Skellets'],
  ['ASCOLD TABS',          41.00, 43.00, 24, 'Skellets'],
  ['ASPIMOL PLUS TABS',    35.00, 42.00, 24, 'Skellets'],
  ['ASPIMOL EXTRA TABS',   42.00, 46.00, 24, 'Skellets'],
  ['ASPIMOL X TABS',       30.00, 38.00, 24, 'Skellets'],
  ['ASPIMAK CAPS',         35.00, 37.00, 24, 'Skellets'],
  ['ASPIDYNE CAPS',        45.00, 48.00, 18, 'Skellets'],
  ['MULTIVITE TABS',       37.00, 40.00, 24, 'Skellets'],
  ['BCO TABS',             35.00, 37.00, 24, 'Skellets'],
  ['ASCAP TABS',           40.00, 42.00, 24, 'Skellets'],
  ['ASPIMOL EXTRA CAPS',   40.00, 45.00, 24, 'Skellets'],
  ['ASTRADOL P CAPLETS',   55.00, null,  24, 'Skellets'],  // no credit price
  ['HAEMATOSE CAPS',       25.00, 28.00, 10, 'Skellets'],  // 10 per carton (official price list)
];

async function main() {
  console.log(`=== ASPEE PHARMA — Official Prices & Bulk Conversions${DRY_RUN ? ' [DRY RUN]' : ''} ===\n`);

  const { data: products, error } = await supabase
    .from('products')
    .select('id, name, sku, cash_price, credit_price, bulk_unit, bulk_to_base_ratio, unit')
    .eq('material_type', 'Finished Good');

  if (error) { console.error('Fetch failed:', error.message); process.exit(1); }

  // Build lookup: normalizedKey → product
  const dbMap = {};
  for (const p of products) {
    dbMap[normalize(p.name)] = p;
  }

  let updated = 0;
  let notFound = [];

  for (const [priceName, cash, credit, pack, unit] of OFFICIAL) {
    let key = normalize(priceName);
    // Apply manual alias if needed
    if (MANUAL_ALIASES[key]) key = MANUAL_ALIASES[key];

    const product = dbMap[key];

    if (!product) {
      notFound.push(priceName);
      continue;
    }

    const payload = {
      cash_price: cash,
      credit_price: credit,
      bulk_unit: 'Cartons',
      bulk_to_base_ratio: pack,
      unit,
    };

    console.log(`→ ${product.name} (${product.sku})`);
    console.log(`   Cash: GH₵${cash}  Credit: ${credit ? 'GH₵' + credit : '—'}  Carton: ${pack} ${unit}`);

    if (!DRY_RUN) {
      const { error: updateErr } = await supabase
        .from('products')
        .update(payload)
        .eq('id', product.id);

      if (updateErr) {
        console.error(`   ✗ ${updateErr.message}`);
        continue;
      }
      console.log('   ✅\n');
    } else {
      console.log('   [dry-run]\n');
    }

    updated++;
  }

  // Delete remaining orphan FG-SEED-* entries that have no priced counterpart
  // (they've either been merged or are covered by the update above)
  if (!DRY_RUN) {
    const { data: orphans } = await supabase
      .from('products')
      .select('id, name, sku')
      .eq('material_type', 'Finished Good')
      .like('sku', 'FG-SEED-%');

    if (orphans && orphans.length > 0) {
      console.log(`\nDeleting ${orphans.length} remaining FG-SEED-* orphan(s)...`);
      for (const o of orphans) {
        const { error: delErr } = await supabase.from('products').delete().eq('id', o.id);
        if (delErr) console.error(`  ✗ Could not delete "${o.name}": ${delErr.message}`);
        else console.log(`  🗑  Deleted "${o.name}" (${o.sku})`);
      }
    }
  }

  console.log('\n' + '─'.repeat(60));
  console.log(`Products updated: ${updated}`);

  if (notFound.length > 0) {
    console.log(`\n⚠️  Not found in DB (need to be added manually):`);
    notFound.forEach(n => console.log(`   • ${n}`));
  }

  const { count } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('material_type', 'Finished Good');

  console.log(`\nTotal finished goods in DB: ${count}`);
  if (DRY_RUN) console.log('\nRe-run without --dry-run to apply changes.');
}

main().catch(err => { console.error('\n❌', err.message); process.exit(1); });
