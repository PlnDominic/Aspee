const fs = require('fs');

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = Object.fromEntries(
    envFile.split('\n')
        .filter(line => line && !line.startsWith('#'))
        .map(line => {
            const idx = line.indexOf('=');
            if (idx === -1) return [line, ''];
            return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()];
        })
);

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY;

// Extract project ref from URL: https://XXXXX.supabase.co
const projectRef = supabaseUrl.replace('https://', '').split('.')[0];

async function runSQL(sql, label) {
    console.log(`Running: ${label}...`);
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseServiceKey,
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Prefer': 'return=minimal'
        },
        body: JSON.stringify({ sql })
    });

    if (!res.ok) {
        const text = await res.text();
        console.log(`  Failed via RPC: ${text}`);
        return false;
    }
    console.log('  OK');
    return true;
}

async function runMigration() {
    console.log('=== Dispatch Module Migration ===\n');
    console.log(`Project: ${projectRef}\n`);

    // First, create exec_sql function if it doesn't exist
    const createExecSql = `
        CREATE OR REPLACE FUNCTION exec_sql(sql text)
        RETURNS void AS $$
        BEGIN
            EXECUTE sql;
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;
    `;

    // Use the pg_net or direct SQL approach via Supabase's /sql endpoint (v1/query)
    // Since exec_sql doesn't exist, we need to use the Supabase SQL editor API
    // which is available at the management API

    // Alternative: Use the PostgREST approach by creating tables via supabase-js
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
        db: { schema: 'public' }
    });

    // Try direct pg query through the /pg endpoint
    console.log('Attempting migration via fetch to SQL endpoint...\n');

    const migrationSQL = fs.readFileSync('migration_dispatch_module.sql', 'utf8');

    // Use Supabase's built-in SQL execution endpoint
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
        method: 'GET',
        headers: {
            'apikey': supabaseServiceKey,
            'Authorization': `Bearer ${supabaseServiceKey}`,
        }
    });

    // Since we can't run raw SQL without exec_sql, let's create the tables
    // using the Supabase Management API
    console.log('Creating tables using Supabase Management API...\n');

    const mgmtRes = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({ query: migrationSQL })
    });

    if (mgmtRes.ok) {
        const result = await mgmtRes.json();
        console.log('Migration executed successfully via Management API!');
        console.log(result);
    } else {
        const errText = await mgmtRes.text();
        console.log(`Management API returned ${mgmtRes.status}: ${errText}`);
        console.log('\n--- MANUAL STEP REQUIRED ---');
        console.log('Please run the following SQL in your Supabase Dashboard SQL Editor:');
        console.log('Go to: https://supabase.com/dashboard/project/' + projectRef + '/sql/new');
        console.log('\nThen paste the contents of: migration_dispatch_module.sql');
    }

    // Verify
    console.log('\nVerifying tables...');
    const { data: d1, error: e1 } = await supabase.from('dispatches').select('id').limit(1);
    console.log('dispatches:', e1 ? `NOT FOUND (${e1.message})` : 'EXISTS');

    const { data: d2, error: e2 } = await supabase.from('dispatch_items').select('id').limit(1);
    console.log('dispatch_items:', e2 ? `NOT FOUND (${e2.message})` : 'EXISTS');
}

runMigration().catch(console.error);
