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
    const { data, error } = await supabase.from('grn_items').select('*').limit(1);
    console.log(JSON.stringify({ data, error }, null, 2));
}

test();
