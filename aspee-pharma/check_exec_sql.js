const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkFunction() {
  console.log('Checking for exec_sql function...');
  
  const { data, error } = await supabase.rpc('check_exec_sql_exists').catch(async () => {
    // If our check function doesn't exist, we try a raw query via a temporary function if possible,
    // or just assume we need to check pg_proc.
    return await supabase.from('pg_proc').select('proname').ilike('proname', 'exec_sql');
  });

  // Since we don't have a reliable way to query pg_proc via RPC unless we have a helper,
  // let's try to just run it with a harmless query. If it works, it exists.
  try {
    const { error: rpcError } = await supabase.rpc('exec_sql', { sql: 'SELECT 1' });
    if (!rpcError) {
      console.log('❌ ALERT: exec_sql function EXISTS and is executable via RPC.');
      
      // Check permissions (this might fail if we don't have a way to read it)
    } else {
      console.log('✅ exec_sql call failed or returned error:', rpcError.message);
    }
  } catch (e) {
    console.log('✅ exec_sql does not seem to exist or is not callable:', e.message);
  }
}

checkFunction();
