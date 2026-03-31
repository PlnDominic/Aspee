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

async function inspectTable(tableName) {
  console.log(`Inspecting ${tableName}...`);
  try {
    // Try to select batch_number to see if it exists
    const { data, error } = await supabase
      .from(tableName)
      .select('batch_number')
      .limit(1);

    if (error) {
      console.log(`Column 'batch_number' likely does not exist in ${tableName}:`, error.message);
    } else {
      console.log(`Column 'batch_number' exists in ${tableName}.`);
    }
    
     const { data: data2, error: error2 } = await supabase
      .from(tableName)
      .select('expiry_date')
      .limit(1);

    if (error2) {
      console.log(`Column 'expiry_date' likely does not exist in ${tableName}:`, error2.message);
    } else {
      console.log(`Column 'expiry_date' exists in ${tableName}.`);
    }

  } catch (err) {
    console.error(`Unexpected error inspecting ${tableName}:`, err.message);
  }
}

async function run() {
  await inspectTable('stock_levels');
}

run();
