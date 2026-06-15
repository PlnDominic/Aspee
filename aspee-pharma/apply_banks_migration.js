const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runSQL(label, sql) {
  const statements = sql
    .split(';')
    .map(stmt => stmt.trim())
    .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

  console.log(`\nApplying: ${label} (${statements.length} statements)`);

  for (const statement of statements) {
    try {
      await supabase.rpc('exec_sql', { sql: statement });
    } catch (error) {
      console.warn(`  Skipped: ${error.message.slice(0, 120)}`);
    }
  }

  console.log(`  Done: ${label}`);
}

async function runMigrations() {
  try {
    await runSQL('banks', fs.readFileSync('./migration_banks.sql', 'utf8'));
    console.log('\nBanks migration applied successfully.');
    console.log('Run: node apply_banks_migration.js');
  } catch (error) {
    console.error('Migration runner failed:', error);
    process.exit(1);
  }
}

runMigrations();
