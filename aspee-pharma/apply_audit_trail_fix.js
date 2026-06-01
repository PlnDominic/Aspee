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
const migrationPath = path.join(__dirname, 'supabase', 'migrations', '20260528000000_fix_audit_trail_auth_user_cast.sql');
const sql = fs.readFileSync(migrationPath, 'utf8');

async function run() {
  const { error } = await supabase.rpc('exec_sql', { sql });

  if (error) {
    console.error('Failed to apply audit trail fix through exec_sql:');
    console.error(error.message);
    console.error('\nRun this SQL manually in Supabase SQL Editor instead:');
    console.error(sql);
    process.exit(1);
  }

  await supabase.rpc('exec_sql', { sql: "NOTIFY pgrst, 'reload schema';" }).catch(() => {});
  console.log('Audit trail auth_user_id cast fix applied.');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
