const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function testRpc() {
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: 'SELECT 1' });
    if (error) {
        console.log('RPC exec_sql NOT available:', error.message);
    } else {
        console.log('RPC exec_sql is available!');
    }
}

testRpc();
