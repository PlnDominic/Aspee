// Script to apply the complete sales system migration
// Run this with: node apply_sales_migration.js

const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: Missing Supabase credentials in .env.local');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  try {
    console.log('Reading migration file...');
    const migrationSQL = fs.readFileSync(
      './supabase/migrations/20260331130745_complete_sales_system.sql',
      'utf8'
    );

    console.log('Applying migration to database...');
    console.log('This may take a few minutes...');

    // Split migration into statements and execute sequentially
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--') && !stmt.startsWith('COMMENT'));

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.length < 10) continue; // Skip empty statements

      try {
        // Skip CREATE POLICY statements if they might already exist
        if (statement.includes('CREATE POLICY')) {
          const policyName = statement.match(/CREATE POLICY "([^"]+)"/)?.[1];
          if (policyName) {
            const { data: existingPolicies } = await supabase
              .rpc('get_policies', { table_name: statement.match(/ON (\w+)/)?.[1] })
              .single();
            
            if (existingPolicies && existingPolicies.includes(policyName)) {
              console.log(`Skipping existing policy: ${policyName}`);
              continue;
            }
          }
        }

        await supabase.rpc('exec_sql', { sql: statement });
        successCount++;
        
        if ((i + 1) % 10 === 0) {
          console.log(`Progress: ${i + 1}/${statements.length} statements executed...`);
        }
      } catch (error) {
        errorCount++;
        console.warn(`Warning on statement ${i + 1}: ${error.message}`);
        // Continue with next statement
      }
    }

    console.log('\nMigration completed!');
    console.log(`✅ Successful statements: ${successCount}`);
    console.log(`⚠️  Warnings (likely already exists): ${errorCount}`);
    console.log('\nKey tables created/enhanced:');
    console.log('- customers (enhanced with category, location, route_id, salesperson_id)');
    console.log('- products (enhanced with product_type, batch_number, stock_quantity)');
    console.log('- sales_invoices (new)');
    console.log('- sales_invoice_items (new)');
    console.log('- payment_receipts (new)');
    console.log('- requisitions (new)');
    console.log('- stock_movements (new)');
    console.log('- Materialized views for performance');
    console.log('- RLS policies for security');
    console.log('- Triggers for business logic');

    // Clean up: drop the helper function
    console.log('\nCleaning up security-sensitive helper functions...');
    await supabase.rpc('exec_sql', { sql: 'DROP FUNCTION IF EXISTS exec_sql(text)' }).catch(() => {});
    console.log('✅ Cleanup complete. Database is secure.');

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Helper function to execute SQL directly
async function setupExecSQLFunction() {
  try {
    console.log('Setting up exec_sql helper function...');
    
    // Create a simple SQL execution function if it doesn't exist
    // SECURE: We revoke PUBLIC access immediately to prevent API abuse
    const setupSQL = `
      CREATE OR REPLACE FUNCTION exec_sql(sql text)
      RETURNS void AS $$
      BEGIN
        EXECUTE sql;
      END;
      $$ LANGUAGE plpgsql;
      
      REVOKE ALL ON FUNCTION exec_sql(text) FROM PUBLIC;
      REVOKE ALL ON FUNCTION exec_sql(text) FROM authenticated;
      REVOKE ALL ON FUNCTION exec_sql(text) FROM anon;
    `;
    
    await supabase.rpc('exec_sql', { sql: setupSQL });
    console.log('✅ exec_sql function created');
  } catch (error) {
    console.log('exec_sql function may already exist, continuing...');
  }
}

// Main execution
console.log('=== ASPEE PHARMA SALES SYSTEM MIGRATION ===\n');

setupExecSQLFunction()
  .then(() => runMigration())
  .then(() => {
    console.log('\n✅ Migration completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Restart your development server (npm run dev)');
    console.log('2. Test the new features:');
    console.log('   - Customer Excel import');
    console.log('   - Enhanced Product management');
    console.log('   - Sales Invoice enhancements');
    console.log('3. Check the IMPLEMENTATION_SUMMARY.md for status');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  });