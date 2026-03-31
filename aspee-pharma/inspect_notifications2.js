const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectNotifications() {
  const result = {};

  let { data: notifs, error: notifsError } = await supabase.from('notifications').select('*').limit(1);
  result.notifications = notifsError ? { error: notifsError } : Object.keys(notifs[0] || {});

  fs.writeFileSync('notifs_inspection.json', JSON.stringify(result, null, 2));
}

inspectNotifications().catch(err => {
    fs.writeFileSync('notifs_inspection.json', JSON.stringify({ error: err.message }));
});
