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

const MIGRATION = '20260526000001_transactional_grn_posting.sql';

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

  // Reload the PostgREST schema cache so public.post_grn is resolvable immediately.
  await supabase.rpc('exec_sql', { sql: "NOTIFY pgrst, 'reload schema';" }).catch(() => {});

  console.log(`Applied ${MIGRATION}`);
  console.log('public.post_grn(grn_payload, item_payload) is now available.');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
