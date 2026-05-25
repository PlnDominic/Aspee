const fs = require('fs');
const dotenv = require('dotenv');

// load env
const envConfig = dotenv.parse(fs.readFileSync('./.env.local'));
for (const k in envConfig) {
    process.env[k] = envConfig[k];
}

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function testFetchAnon() {
  console.log('Testing Query 1 (system_users) using Anon Key...');
  const { data: users, error: usersError } = await supabase
    .from('system_users')
    .select('id, name, email')
    .eq('status', 'Active')
    .in('role', ['Van Sales Rep', 'Sales Manager'])
    .order('name');
  
  if (usersError) {
    console.error('Query 1 Failed:', usersError.message);
  } else {
    console.log('Query 1 Succeeded, count:', users?.length);
  }

  console.log('\nTesting Query 2 (vans) using Anon Key...');
  const { data: vans, error: vansError } = await supabase
    .from('vans')
    .select('id, van_id, driver_name, route_area')
    .neq('status', 'Maintenance')
    .order('van_id');

  if (vansError) {
    console.error('Query 2 Failed:', vansError.message);
  } else {
    console.log('Query 2 Succeeded, count:', vans?.length);
  }

  console.log('\nTesting Query 3 (products) using Anon Key...');
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, name, sku, unit, material_type, cash_price, units_per_carton, unit_label')
    .eq('material_type', 'Finished Good')
    .order('name');

  if (productsError) {
    console.error('Query 3 Failed:', productsError.message);
  } else {
    console.log('Query 3 Succeeded, count:', products?.length);
  }
}

testFetchAnon().catch(console.error);
