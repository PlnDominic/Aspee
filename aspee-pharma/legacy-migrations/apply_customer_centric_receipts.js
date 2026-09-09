const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const migrations = [
  '20260602000000_customer_centric_receipts.sql',
  '20260602000001_customer_receipt_rpc.sql',
];

async function applyOne(filename) {
  const migrationPath = path.join(__dirname, 'supabase', 'migrations', filename);
  const sql = fs.readFileSync(migrationPath, 'utf8');

  const { error } = await supabase.rpc('exec_sql', { sql });
  if (error) {
    console.error(`\n--- Failed to apply ${filename} via exec_sql ---`);
    console.error(error.message);
    console.error('\nRun this SQL manually in the Supabase SQL Editor:');
    console.error('================================================');
    console.error(sql);
    console.error('================================================\n');
    return false;
  }
  console.log(`Applied ${filename}`);
  return true;
}

async function run() {
  let ok = true;
  for (const m of migrations) {
    const success = await applyOne(m);
    if (!success) ok = false;
  }
  await supabase.rpc('exec_sql', { sql: "NOTIFY pgrst, 'reload schema';" }).catch(() => {});
  if (!ok) process.exit(1);
  console.log('\nAll customer-centric receipt migrations applied.');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
