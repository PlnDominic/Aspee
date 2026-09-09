const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
    const sql = fs.readFileSync(path.join(__dirname, 'migration_profiles_read_all.sql'), 'utf8');
    const { error } = await supabase.rpc('exec_sql', { sql });
    if (error) {
        console.error('Migration failed:', error.message);
        process.exit(1);
    }
    console.log('✓ Profiles read-all policy applied');
}

run();
