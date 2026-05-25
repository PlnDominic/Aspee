// Merge duplicate finished goods:
//   - "Real" products (Title Case, existing SKUs) have official prices but no bulk conversion
//   - Seed products (ALL CAPS, FG-SEED-* SKUs) have bulk conversion but no prices
// This script copies bulk info onto the real product then deletes the seed duplicate.
//
// Run: node apply_merge_finished_goods.js
// Run with --dry-run to preview without making changes

const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

const DRY_RUN = process.argv.includes('--dry-run');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Normalize a product name to a comparable key:
// "Adult-Cof Syrup"  → "adultcof"
// "ADULTCOF SYRUP"   → "adultcof"
// "Ascold Tablets"   → "ascold"
// "ASCOLD TABLET"    → "ascold"
function normalize(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')              // strip spaces, hyphens, parens, %
    .replace(/syrup|tablets?|capsules?|drops?/g, ''); // strip product type words
}

async function main() {
  console.log(`=== ASPEE PHARMA — Merge Duplicate Finished Goods${DRY_RUN ? ' [DRY RUN]' : ''} ===\n`);

  const { data: products, error } = await supabase
    .from('products')
    .select('id, name, sku, unit, cash_price, credit_price, bulk_unit, bulk_to_base_ratio, reorder_level')
    .eq('material_type', 'Finished Good');

  if (error) {
    console.error('Fetch failed:', error.message);
    process.exit(1);
  }

  // Group products by their normalised name
  const groups = {};
  for (const p of products) {
    const key = normalize(p.name);
    if (!groups[key]) groups[key] = [];
    groups[key].push(p);
  }

  let mergedCount = 0;
  let skippedCount = 0;

  for (const [key, group] of Object.entries(groups)) {
    if (group.length < 2) continue;

    // The canonical product is the one with official prices set
    const canonical = group.find(p => p.cash_price != null || p.credit_price != null);
    // The seed duplicate is the one with bulk conversion (FG-SEED-* SKU)
    const seed = group.find(
      p => p.bulk_unit != null && p.bulk_to_base_ratio != null && p.sku?.includes('SEED')
    );

    if (!canonical || !seed || canonical.id === seed.id) {
      if (group.length >= 2) {
        console.log(`⚠️  Skipping group [${key}] — cannot determine canonical vs seed:`);
        group.forEach(p => console.log(`     ${p.sku}  "${p.name}"  prices=${p.cash_price != null}  bulk=${p.bulk_unit != null}`));
        skippedCount++;
      }
      continue;
    }

    const bulkLabel = `1 ${seed.bulk_unit} = ${seed.bulk_to_base_ratio} ${seed.unit}`;
    console.log(`→ Merge: "${seed.name}" (${seed.sku}) into "${canonical.name}" (${canonical.sku})`);
    console.log(`         Bulk: ${bulkLabel}  |  Unit: ${canonical.unit} → ${seed.unit}`);

    if (!DRY_RUN) {
      // Copy bulk conversion onto the canonical product; also align unit to seed's unit
      const { error: updateErr } = await supabase
        .from('products')
        .update({
          bulk_unit: seed.bulk_unit,
          bulk_to_base_ratio: seed.bulk_to_base_ratio,
          unit: seed.unit,  // ensure unit matches (Skellets for tablets, Bottles for syrups)
        })
        .eq('id', canonical.id);

      if (updateErr) {
        console.error(`   ✗ Update failed: ${updateErr.message}`);
        continue;
      }

      // Delete the seed duplicate
      const { error: deleteErr } = await supabase
        .from('products')
        .delete()
        .eq('id', seed.id);

      if (deleteErr) {
        console.error(`   ✗ Delete failed: ${deleteErr.message}`);
        continue;
      }

      console.log('   ✅ Done\n');
    } else {
      console.log('   [dry-run — no changes made]\n');
    }

    mergedCount++;
  }

  const { count } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('material_type', 'Finished Good');

  console.log('─'.repeat(60));
  console.log(`Pairs merged:  ${mergedCount}`);
  console.log(`Pairs skipped: ${skippedCount}`);
  console.log(`Finished goods in DB: ${count}`);

  if (DRY_RUN) {
    console.log('\nRe-run without --dry-run to apply changes.');
  }

  // List any remaining FG-SEED-* entries that had no match (no prices found for them)
  const { data: orphans } = await supabase
    .from('products')
    .select('name, sku, unit, bulk_to_base_ratio')
    .eq('material_type', 'Finished Good')
    .like('sku', 'FG-SEED-%');

  if (orphans && orphans.length > 0) {
    console.log('\n⚠️  Remaining FG-SEED-* entries (no matching priced product found — review manually):');
    orphans.forEach(p => console.log(`   ${p.sku}  "${p.name}"  [${p.unit}, ${p.bulk_to_base_ratio}/ctn]`));
  }
}

main().catch(err => {
  console.error('\n❌ Unexpected error:', err.message);
  process.exit(1);
});
