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

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  console.log('Inspecting stock_locations table...');
  
  // We can't easily get constraints via PostgREST, but we can try to fetch data to see valid values
  const { data, error } = await supabase
    .from('stock_locations')
    .select('*')
    .limit(10);

  if (error) {
    console.error('Error fetching stock_locations:', error.message);
  } else {
    console.log('Existing locations:');
    console.table(data);
  }
}

run();
