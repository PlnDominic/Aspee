const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

async function checkUnitPrice() {
  if (!dbUrl) {
    console.error("No DATABASE_URL found in .env.local");
    return;
  }

  const client = new Client({ connectionString: dbUrl });
  try {
    await client.connect();
    console.log('Connected to database successfully!');

    // 1. Search columns in tables
    console.log('\n--- Searching columns with "unit_price" in table names ---');
    const colsRes = await client.query(`
      SELECT table_name, column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND column_name LIKE '%unit_price%'
      ORDER BY table_name, column_name
    `);
    console.log(JSON.stringify(colsRes.rows, null, 2));

    // 2. Search views containing the term "unit_price"
    console.log('\n--- Searching views referencing "unit_price" ---');
    const viewsRes = await client.query(`
      SELECT viewname, definition 
      FROM pg_views 
      WHERE schemaname = 'public' AND definition LIKE '%unit_price%'
    `);
    viewsRes.rows.forEach(r => {
      console.log(`View: ${r.viewname}`);
    });

    // 3. Search functions containing "unit_price"
    console.log('\n--- Searching functions referencing "unit_price" ---');
    const funcsRes = await client.query(`
      SELECT proname, prosrc 
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public' AND prosrc LIKE '%unit_price%'
    `);
    funcsRes.rows.forEach(r => {
      console.log(`Function: ${r.proname}`);
    });

    // 4. Search triggers/rules referencing "unit_price"
    console.log('\n--- Searching triggers referencing "unit_price" ---');
    const triggersRes = await client.query(`
      SELECT trigger_name, event_object_table, action_statement 
      FROM information_schema.triggers 
      WHERE trigger_schema = 'public' AND (action_statement LIKE '%unit_price%' OR trigger_name LIKE '%unit_price%')
    `);
    console.log(JSON.stringify(triggersRes.rows, null, 2));

    // 5. Search policies containing "unit_price"
    console.log('\n--- Searching RLS policies referencing "unit_price" ---');
    const policiesRes = await client.query(`
      SELECT tablename, policyname, qual, with_check 
      FROM pg_policies 
      WHERE schemaname = 'public' AND (qual LIKE '%unit_price%' OR with_check LIKE '%unit_price%')
    `);
    console.log(JSON.stringify(policiesRes.rows, null, 2));

  } catch (err) {
    console.error('Error running queries:', err);
  } finally {
    await client.end();
  }
}

checkUnitPrice();
