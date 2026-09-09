require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const fs = require('fs');

async function run() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("No DATABASE_URL found in .env.local");
    process.exit(1);
  }

  const client = new Client({
    connectionString,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    const sql = fs.readFileSync('migration_add_batch_number_to_production.sql', 'utf8');
    await client.connect();
    console.log("Connected to DB.");

    console.log("Applying migration...");
    await client.query(sql);

    console.log("Migration successful!");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await client.end();
  }
}

run();
