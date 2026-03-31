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

async function inspectTable(tableName) {
  console.log(`Inspecting ${tableName}...`);
  const { data, error } = await supabase.from(tableName).select('*').limit(1);
  if (error) {
    console.error(`Error fetching ${tableName}: ${error.message}`);
  } else if (data && data.length > 0) {
    console.log(`Columns for ${tableName}:`, Object.keys(data[0]));
  } else {
    console.log(`${tableName} table is empty or has no data.`);
  }
}

async function run() {
  const tables = ['journal_entries', 'expenses', 'petty_cash', 'sales_invoices', 'sales_receipts', 'purchase_orders', 'supplier_payments'];
  for (const table of tables) {
    await inspectTable(table);
  }
}

run();
