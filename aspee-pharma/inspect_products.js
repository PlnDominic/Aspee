import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
  console.log('Inspecting products table...');
  
  // Check foreign keys
  const { data: foreignKeys, error: fkError } = await supabase.rpc('get_foreign_keys_for_table', { table_name: 'products' });
  
  // If no RPC, let's just do a basic query to see if there is any hidden error during delete
  // Or check pg_policies
  
  // Actually, we can just run a select query to see what happens
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .limit(1);

  console.log('Sample product:', data?.[0]);

  if (data?.[0]) {
    // try to delete it to see the error message? No, we don't want to break the DB!
    console.log('Do not delete without knowing!');
  }
}

inspect().catch(console.error);
