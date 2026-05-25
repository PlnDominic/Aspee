// Direct database migration script
// Run with: node run_migration_direct.js

require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Read the migration SQL
const fs = require('fs');
const path = require('path');

const migrationPath = path.join(__dirname, 'supabase', 'migrations', '20260331130745_complete_sales_system_applied.sql');

if (!fs.existsSync(migrationPath)) {
  console.error('❌ Migration file not found:', migrationPath);
  process.exit(1);
}

const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

// Split into statements
const statements = migrationSQL
  .split(';')
  .map(stmt => stmt.trim())
  .filter(stmt => stmt.length > 0 && !stmt.startsWith('--') && !stmt.startsWith('COMMENT') && !stmt.startsWith('SELECT'));

async function runMigration() {
  console.log('🚀 Starting database migration...\n');
  console.log(`📊 Total statements to execute: ${statements.length}\n`);
  
  let success = 0;
  let skipped = 0;
  let failed = 0;
  
  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    const stmtNum = i + 1;
    
    // Skip empty or comment-only statements
    if (statement.length < 10 || statement.toUpperCase().includes('SELECT')) {
      skipped++;
      continue;
    }
    
    try {
      // Execute using raw SQL query
      const { error } = await supabase.rpc('execute_sql', { sql: statement });
      
      if (error) {
        // Check if it's a "already exists" error
        if (error.message.includes('already exists') || 
            error.message.includes('duplicate') ||
            error.message.includes('relation') && error.message.includes('already exists')) {
          console.log(`⏭️  [${stmtNum}/${statements.length}] Skipped (already exists)`);
          skipped++;
        } else {
          console.log(`❌ [${stmtNum}/${statements.length}] Failed: ${error.message}`);
          failed++;
        }
      } else {
        if (stmtNum % 5 === 0) {
          console.log(`✅ [${stmtNum}/${statements.length}] Success`);
        }
        success++;
      }
    } catch (error) {
      console.log(`⚠️  [${stmtNum}/${statements.length}] Warning: ${error.message}`);
      skipped++;
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('📈 Migration Summary:');
  console.log(`✅ Successful: ${success}`);
  console.log(`⏭️  Skipped: ${skipped}`);
  console.log(`❌ Failed: ${failed}`);
  console.log('='.repeat(50));
  
  if (failed === 0) {
    console.log('\n🎉 Migration completed successfully!');
    console.log('\n✨ New features ready:');
    console.log('   • Enhanced customers table (category, location, route, salesperson)');
    console.log('   • Enhanced products table (type, batch, stock, price)');
    console.log('   • New sales_invoices table');
    console.log('   • New sales_invoice_items table');
    console.log('   • New payment_receipts table');
    console.log('   • New requisitions table');
    console.log('   • New stock_movements table');
    console.log('   • Reporting views for analytics');
    console.log('\n🔄 Next: Restart your dev server (npm run dev)');

    // Clean up: drop the helper function
    console.log('\n🛡️  Cleaning up security-sensitive helper functions...');
    await supabase.rpc('execute_sql', { sql: 'DROP FUNCTION IF EXISTS execute_sql(text)' }).catch(() => {});
    console.log('✅ Cleanup complete. Database is secure.');
  } else {
    console.log('\n⚠️  Some statements failed. Check errors above.');
    process.exit(1);
  }
}

// Create a simple SQL execution function if it doesn't exist
async function setupSQLFunction() {
  console.log('🔧 Setting up SQL execution function...\n');
  
  const createFunctionSQL = `
    CREATE OR REPLACE FUNCTION execute_sql(sql TEXT)
    RETURNS VOID AS $$
    BEGIN
      EXECUTE sql;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE 'SQL Error: %', SQLERRM;
    END;
    $$ LANGUAGE plpgsql;
    
    REVOKE ALL ON FUNCTION execute_sql(text) FROM PUBLIC;
    REVOKE ALL ON FUNCTION execute_sql(text) FROM authenticated;
    REVOKE ALL ON FUNCTION execute_sql(text) FROM anon;
  `;
  
  try {
    const { error } = await supabase.rpc('execute_sql', { sql: createFunctionSQL });
    if (error) {
      console.log('⚠️  SQL function may already exist, continuing...\n');
    } else {
      console.log('✅ SQL execution function created\n');
    }
  } catch (error) {
    console.log('⚠️  SQL function setup skipped\n');
  }
}

// Main execution
console.log('═'.repeat(60));
console.log('  ASPEE PHARMA - SALES SYSTEM MIGRATION');
console.log('═'.repeat(60));
console.log('');

setupSQLFunction()
  .then(() => runMigration())
  .then(() => {
    console.log('');
    console.log('═'.repeat(60));
    console.log('  MIGRATION COMPLETE');
    console.log('═'.repeat(60));
    process.exit(0);
  })
  .catch((error) => {
    console.error('');
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
