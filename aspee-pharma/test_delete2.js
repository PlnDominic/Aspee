import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDel() {
  console.log('Testing delete with anon key (try 3)...');
  
  // Create a product
  const { data: inserted, error: insErr } = await supabase.from('products').insert({
    name: 'TEST_DEL_PROD_ANON_3',
    material_type: 'Finished Good',
    unit: 'pcs',
    reorder_level: 10,
    sku: 'TEST-SKU-1'
  }).select().single();

  if (insErr) {
    console.error('Insert error (need more fields?):', JSON.stringify(insErr, null, 2));
    return;
  }

  console.log('Inserted:', inserted.id);

  // Now delete it
  const { data: deleted, error: delErr } = await supabase.from('products').delete().eq('id', inserted.id).select();
  
  if (delErr) {
     console.log('Delete error:', JSON.stringify(delErr, null, 2));
     return;
  }
  
  console.log('Successfully deleted:', deleted);
}

checkDel();
