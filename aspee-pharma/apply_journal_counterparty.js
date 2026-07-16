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

const MIGRATION = '20260716000000_journal_counterparty.sql';

async function run() {
  const migrationPath = path.join(__dirname, 'supabase', 'migrations', MIGRATION);
  const sql = fs.readFileSync(migrationPath, 'utf8');

  const { error } = await supabase.rpc('exec_sql', { sql });
  if (error) {
    console.error(`\n--- Failed to apply ${MIGRATION} via exec_sql ---`);
    console.error(error.message);
    console.error('\nRun this SQL manually in the Supabase SQL Editor:');
    console.error('================================================');
    console.error(sql);
    console.error('================================================\n');
    process.exit(1);
  }

  // Ask PostgREST to reload its schema cache so the new column is visible.
  await supabase.rpc('exec_sql', { sql: "NOTIFY pgrst, 'reload schema';" }).catch(() => {});

  console.log(`Applied ${MIGRATION}`);
  console.log('journal_entries.counterparty_name is now live (column + trigger + backfill).');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
