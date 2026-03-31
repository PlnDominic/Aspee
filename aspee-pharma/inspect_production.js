const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = Object.fromEntries(
  envFile.split('\n')
    .filter(line => line && !line.startsWith('#'))
    .map(line => {
      const idx = line.indexOf('=');
      if (idx === -1) return [line, ''];
      return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()];
    })
);

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  console.log('Inspecting production_orders columns...');
  
  // Fetch one row to see columns
  const { data, error } = await supabase.from('production_orders').select('*').limit(1);
  if (error) {
    console.error('Error:', error.message);
  } else {
    console.log('Columns:', data.length > 0 ? Object.keys(data[0]) : 'No data, trying to insert dummy...');
    
    if (data.length === 0) {
        // Try to fetch specific columns to see if they exist
        const { error: colError } = await supabase.from('production_orders').select('product_id').limit(1);
        console.log('product_id exists?', !colError);
    }
  }
}

run();
