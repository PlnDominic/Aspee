require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function run() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('No DATABASE_URL found in .env.local');
    process.exit(1);
  }

  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

  try {
    await client.connect();
    console.log('Connected to DB.');

    const sql = fs.readFileSync(
      path.join(__dirname, 'supabase/migrations/20260528000002_fix_auth_user_id_comparison.sql'),
      'utf8'
    );
    await client.query(sql);

    console.log('Migration applied: all impl functions updated to cast auth_user_uuid::text.');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
