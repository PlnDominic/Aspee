const { Client } = require('pg');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

// Supabase connection string is often in NEXT_PUBLIC_SUPABASE_URL but we need DATABASE_URL
// Let's check if DATABASE_URL or SUPABASE_DB_URL is in env
const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

async function checkSchema() {
  if (!dbUrl) {
    fs.writeFileSync('schema_output.json', JSON.stringify({ error: "No DATABASE_URL found in .env.local" }));
    return;
  }

  const client = new Client({ connectionString: dbUrl });
  try {
    await client.connect();
    const result = { invoices: [], receipts: [], po: [], products: [] };
    
    // Get columns for sales_invoices
    const invoicesRes = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'sales_invoices'
    `);
    result.invoices = invoicesRes.rows;

    // Get columns for sales_receipts
    const receiptsRes = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'sales_receipts'
    `);
    result.receipts = receiptsRes.rows;

    // Get columns for products
    const productsRes = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'products'
    `);
    result.products = productsRes.rows;

    fs.writeFileSync('schema_output.json', JSON.stringify(result, null, 2));
  } catch (err) {
    fs.writeFileSync('schema_output.json', JSON.stringify({ error: err.message }));
  } finally {
    await client.end();
  }
}

checkSchema();
