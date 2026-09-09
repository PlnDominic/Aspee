const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

async function applyMigration() {
  if (!dbUrl) {
    console.error('No DATABASE_URL found in .env.local');
    console.log('Please add DATABASE_URL to your .env.local file');
    console.log('You can get this from Supabase Dashboard > Settings > Database');
    process.exit(1);
  }

  const client = new Client({ connectionString: dbUrl });
  try {
    await client.connect();

    const migrationPath = path.join(
      __dirname,
      'supabase',
      'migrations',
      '20260731000000_material_request_usage_tracking.sql'
    );
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('Applying material request usage tracking migration...');
    await client.query(sql);
    console.log('Migration applied successfully!');
  } catch (err) {
    console.error('Error applying migration:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigration();
