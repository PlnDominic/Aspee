// Fix credit_notes: add FK constraint on invoice_id -> sales_invoices
// This enables PostgREST to resolve the embedded join query
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SQL = `
-- Add FK constraint so PostgREST can resolve the join
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_type = 'FOREIGN KEY'
        AND table_name = 'credit_notes'
        AND constraint_name = 'credit_notes_invoice_id_fkey'
    ) THEN
        ALTER TABLE credit_notes
            ADD CONSTRAINT credit_notes_invoice_id_fkey
            FOREIGN KEY (invoice_id) REFERENCES sales_invoices(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
`;

async function run() {
    console.log('Attempting to add FK constraint on credit_notes.invoice_id...\n');

    // Try RPC first
    const { error } = await supabase.rpc('exec_sql', { sql: SQL });

    if (error) {
        console.log('exec_sql RPC not available. Please run the following SQL in the Supabase SQL Editor:\n');
        console.log('='.repeat(60));
        console.log(SQL);
        console.log('='.repeat(60));
        console.log('\nGo to: https://supabase.com/dashboard → SQL Editor → New Query → Paste & Run');
        console.log('\nAfter running the SQL, the credit notes page should load correctly.');
    } else {
        console.log('FK constraint added successfully!');
    }

    // Verify
    console.log('\nVerifying join query...');
    const { data, error: joinErr } = await supabase
        .from('credit_notes')
        .select('id, cn_number, invoice:sales_invoices(invoice_number)')
        .limit(1);

    if (joinErr) {
        console.log('Join still fails:', joinErr.message);
        console.log('\n→ The FK constraint needs to be added via the SQL Editor.');
    } else {
        console.log('Join works! Credit notes page should now load correctly.');
    }
}

run().catch(console.error);
