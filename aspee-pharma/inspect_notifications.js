const { Client } = require('pg');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

async function checkSchema() {
  if (!dbUrl) {
    fs.writeFileSync('schema_output.json', JSON.stringify({ error: "No DATABASE_URL found in .env.local" }));
    return;
  }

  const client = new Client({ connectionString: dbUrl });
  try {
    await client.connect();
    const result = {};
    
    // Check if notifications table exists
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'notifications'
    `);
    
    if (tablesRes.rows.length > 0) {
      const colsRes = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'notifications'
      `);
      result.notifications = colsRes.rows;
    } else {
      result.notifications = "Table does not exist";
    }

    fs.writeFileSync('schema_output.json', JSON.stringify(result, null, 2));
  } catch (err) {
    fs.writeFileSync('schema_output.json', JSON.stringify({ error: err.message }));
  } finally {
    await client.end();
  }
}

checkSchema();
