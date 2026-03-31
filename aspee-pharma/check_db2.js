const fs = require('fs');
const dotenv = require('dotenv');
// load .env.local
const envConfig = dotenv.parse(fs.readFileSync('./.env.local'));
for (const k in envConfig) {
    process.env[k] = envConfig[k];
}

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function test() {
    // get table columns using postgres meta or just try to insert a fake record and see the error
    const { data, error } = await supabase.rpc('get_columns_for_table', { table_name: 'grn_items' });
    if(error) {
        // another way: select from information_schema
        const {data: cols, error: err2} = await supabase.from('grn_items').select('*').limit(0);
        console.log(JSON.stringify({ data: cols, error: err2 }, null, 2));
    } else {
        console.log(JSON.stringify({ data, error }, null, 2));
    }
}

test();
