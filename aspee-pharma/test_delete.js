import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceKey);

async function checkDel() {
  // Let's create a test product
  const { data: inserted, error: insErr } = await supabase.from('products').insert({
    name: 'TEST_DEL_PROD',
    material_type: 'Finished Good'
  }).select().single();

  if (insErr) {
    console.error('Insert error:', insErr);
    return;
  }

  console.log('Inserted:', inserted.id);

  // Now delete it
  const { data: deleted, error: delErr } = await supabase.from('products').delete().eq('id', inserted.id).select();
  
  console.log('Deleted data:', deleted);
  console.log('Delete error:', delErr);

  // Check policies on products
  const { data: policies, error: polErr } = await supabase.rpc('get_policies', { table_name: 'products' });
  if (polErr) {
    // maybe RPC doesn't exist, we can query pg_policies
    const query = await supabase.from('pg_policies').select('*').eq('tablename', 'products');
    console.log('Policies API result:', query);
  } else {
    console.log('Policies RPC:', policies);
  }
}

checkDel();
