const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkTables() {
    try {
        const { error: err1 } = await supabase.from('purchase_requests').select('id').limit(1);
        console.log('purchase_requests:', err1 ? 'NOT FOUND (' + err1.message + ')' : 'EXISTS');
        
        const { error: err2 } = await supabase.from('purchase_request_items').select('id').limit(1);
        console.log('purchase_request_items:', err2 ? 'NOT FOUND (' + err2.message + ')' : 'EXISTS');
    } catch (e) {
        console.error(e);
    }
}

checkTables();
