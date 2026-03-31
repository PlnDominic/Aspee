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
  console.log('Inspecting stock_locations metadata...');
  
  // Try to find what types are allowed by attempting a dummy insert and seeing if it fails or by querying if possible
  // Since we can't query information_schema easily via PostgREST, we'll try to infer from errors or use a direct SQL if possible
  // But wait, npx supabase db execute should work if I don't use --debug but piping? 
  // Let's try to just fetch one row if any exists
  const { data, error } = await supabase.from('stock_locations').select('*').limit(1);
  console.log('Sample Data:', data);
  console.log('Fetch Error:', error);
}

run();
