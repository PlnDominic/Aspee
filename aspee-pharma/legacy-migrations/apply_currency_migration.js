require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

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
    await client.connect();
    console.log("Connected to DB.");

    await client.query(`
      ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'GHS';
      ALTER TABLE supplier_payments ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'GHS';
      ALTER TABLE expenses ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'GHS';
    `);

    console.log("Migration successful!");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await client.end();
  }
}

run();
