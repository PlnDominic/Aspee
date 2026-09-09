const { Client } = require('pg');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

async function applyMigration() {
  if (!dbUrl) {
    console.error("No DATABASE_URL found in .env.local");
    console.log("Please add DATABASE_URL to your .env.local file");
    console.log("You can get this from Supabase Dashboard > Settings > Database");
    return;
  }

  const client = new Client({ connectionString: dbUrl });
  try {
    await client.connect();
    
    const sql = fs.readFileSync('./migration_po_approval_workflow.sql', 'utf8');
    
    console.log("Applying PO approval workflow migration...");
    await client.query(sql);
    console.log("Migration applied successfully!");
    
  } catch (err) {
    console.error("Error applying migration:", err.message);
  } finally {
    await client.end();
  }
}

applyMigration();
