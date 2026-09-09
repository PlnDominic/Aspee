const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

// The public.issue_material_request(uuid) RPC (called when Stores issues a
// material request) was never actually applied to this database — only its
// migration files existed in the repo. This runs them in order: the
// migration that originally creates the function, then the three later
// migrations that fix its auth_user_id type comparison, so the function
// ends up in its final, correct state.
const MIGRATIONS = [
  '20260525150321_transactional_material_request_issuance.sql',
  '20260528000002_fix_auth_user_id_comparison.sql',
  '20260528000003_fix_impl_functions_uuid_column.sql',
  '20260528000004_fix_impl_functions_universal_cast.sql',
];

async function applyMigrations() {
  if (!dbUrl) {
    console.error('No DATABASE_URL found in .env.local');
    console.log('Please add DATABASE_URL to your .env.local file');
    console.log('You can get this from Supabase Dashboard > Settings > Database');
    process.exit(1);
  }

  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();

    for (const file of MIGRATIONS) {
      const migrationPath = path.join(__dirname, 'supabase', 'migrations', file);
      const sql = fs.readFileSync(migrationPath, 'utf8');
      console.log(`Applying ${file}...`);
      await client.query(sql);
    }

    console.log('issue_material_request is now available. Migration applied successfully!');
  } catch (err) {
    console.error('Error applying migration:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigrations();
