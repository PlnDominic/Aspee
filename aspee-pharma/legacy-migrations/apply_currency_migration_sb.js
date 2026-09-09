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

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  console.log("Adding currency columns...");

  // Supabase JS doesn't have a direct raw SQL execution method via the REST API in standard client 
  // without a stored procedure (RPC).
  // However, we can try to call a standard API function or just use the local Supabase CLI.
  
  console.log("Consider using Supabase SQL editor on the dashboard to run: ");
  console.log("ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'GHS';");
  console.log("ALTER TABLE supplier_payments ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'GHS';");
  console.log("ALTER TABLE expenses ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'GHS';");
}

run();
