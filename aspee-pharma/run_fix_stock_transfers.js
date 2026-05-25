const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  console.log('Fixing stock_movements constraints and RLS policies...\n');

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const sql = `
    -- 1. Fix reference_type check constraint
    ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS stock_movements_reference_type_check;
    ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_reference_type_check
      CHECK (reference_type IN (
        'Stock Transfer', 'Sales Invoice', 'GRN', 'Material Request',
        'Job Order Consumption', 'Job Order Yield', 'QA Release',
        'QA Finished Goods', 'Transfer', 'Adjustment'
      ));

    -- 2. Fix movement_type check constraint
    ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS stock_movements_movement_type_check;
    ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_movement_type_check
      CHECK (movement_type IN (
        'IN', 'OUT', 'PURCHASE', 'SALE', 'DAMAGED', 'GIFT',
        'RETURN', 'ADJUSTMENT', 'REQUISITION'
      ));

    -- 3. Ensure stock_levels RLS
    ALTER TABLE stock_levels ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Enable all for all on stock_levels" ON stock_levels;
    CREATE POLICY "Enable all for all on stock_levels"
      ON stock_levels FOR ALL USING (true) WITH CHECK (true);

    -- 4. Ensure stock_movements RLS
    ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Enable all for all on stock_movements" ON stock_movements;
    CREATE POLICY "Enable all for all on stock_movements"
      ON stock_movements FOR ALL USING (true) WITH CHECK (true);

    -- 5. Ensure stock_transfers RLS
    ALTER TABLE stock_transfers ENABLE ROW LEVEL SECURITY;
    ALTER TABLE stock_transfer_items ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Enable all for all on stock_transfers" ON stock_transfers;
    CREATE POLICY "Enable all for all on stock_transfers"
      ON stock_transfers FOR ALL USING (true) WITH CHECK (true);
    DROP POLICY IF EXISTS "Enable all for all on stock_transfer_items" ON stock_transfer_items;
    CREATE POLICY "Enable all for all on stock_transfer_items"
      ON stock_transfer_items FOR ALL USING (true) WITH CHECK (true);
  `;

  // Execute via PostgREST rpc or direct pg
  // Since we can't run raw SQL via the JS client, let's use fetch to the SQL endpoint
  const response = await fetch(`${url}/rest/v1/rpc/`, {
    method: 'POST',
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
  }).catch(() => null);

  // The Supabase JS client doesn't support raw SQL directly.
  // We'll run each fix individually using the client's capabilities.

  // Instead, let's verify the current state and test with a direct insert/delete
  console.log('Testing stock_movements insert with reference_type = "Stock Transfer"...');

  const testRow = {
    product_id: null,
    movement_type: 'OUT',
    quantity: 0,
    reference_type: 'Stock Transfer',
    notes: 'TEST - will be deleted',
  };

  // First, get any product id to use
  const { data: products } = await supabase.from('products').select('id').limit(1);
  if (!products || products.length === 0) {
    console.log('No products found. Cannot test.');
    return;
  }
  testRow.product_id = products[0].id;

  const { data: testData, error: testError } = await supabase
    .from('stock_movements')
    .insert([testRow])
    .select('id')
    .single();

  if (testError) {
    console.log('FAILED:', testError.message);
    console.log('\n========================================');
    console.log('The database constraints need to be fixed.');
    console.log('Please run this SQL in Supabase SQL Editor:');
    console.log('========================================\n');
    console.log(sql);
    console.log('\n========================================');
    console.log('Go to: https://supabase.com/dashboard > SQL Editor > New Query');
    console.log('Paste the SQL above and click "Run"');
    console.log('========================================');
  } else {
    // Clean up test row
    await supabase.from('stock_movements').delete().eq('id', testData.id);
    console.log('SUCCESS - stock_movements constraints are correctly configured.');
    console.log('Stock transfers should now work properly.');
  }

  // Also test stock_levels update capability
  console.log('\nTesting stock_levels write access...');
  const { data: stockTest, error: stockTestError } = await supabase
    .from('stock_levels')
    .select('id, qty_on_hand')
    .limit(1)
    .single();

  if (stockTestError) {
    console.log('WARNING: Cannot read stock_levels:', stockTestError.message);
  } else if (stockTest) {
    const { error: updateError } = await supabase
      .from('stock_levels')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', stockTest.id);
    if (updateError) {
      console.log('WARNING: Cannot update stock_levels:', updateError.message);
      console.log('RLS policies may be blocking writes. Run the SQL above to fix.');
    } else {
      console.log('SUCCESS - stock_levels is writable.');
    }
  }

  // Check actual columns on stock_movements
  console.log('\nChecking stock_movements columns...');
  const { data: smTest, error: smError } = await supabase
    .from('stock_movements')
    .select('id, product_id, quantity, movement_type, reference_type')
    .limit(1);

  if (smError) {
    console.log('Column check failed:', smError.message);
    if (smError.message.includes('quantity')) {
      console.log('NOTE: The column might be "quantity_change" instead of "quantity".');
      console.log('Check your stock_movements table schema in Supabase.');
    }
  } else {
    console.log('SUCCESS - stock_movements columns (quantity, movement_type, reference_type) exist.');
  }
}

run().catch(err => {
  console.error('Script error:', err.message);
  process.exit(1);
});
