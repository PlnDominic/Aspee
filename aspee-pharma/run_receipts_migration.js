// Apply sales_receipts table migration
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const sql = `
CREATE TABLE IF NOT EXISTS sales_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_number TEXT UNIQUE NOT NULL,
    invoice_id UUID REFERENCES sales_invoices(id) ON DELETE CASCADE,
    customer_name TEXT NOT NULL,
    date DATE NOT NULL,
    payment_method TEXT NOT NULL,
    payment_reference TEXT,
    amount DECIMAL(15,2) NOT NULL,
    currency TEXT DEFAULT 'GHS',
    notes TEXT,
    status TEXT DEFAULT 'Confirmed',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_receipts_invoice_id ON sales_receipts(invoice_id);
CREATE INDEX IF NOT EXISTS idx_sales_receipts_date ON sales_receipts(date);
CREATE INDEX IF NOT EXISTS idx_sales_receipts_payment_method ON sales_receipts(payment_method);

ALTER TABLE sales_receipts ENABLE ROW LEVEL SECURITY;
`;

async function run() {
  console.log('Applying sales_receipts migration...');
  const { error } = await supabase.rpc('exec_sql', { sql }).catch(() => ({ error: 'rpc not available' }));

  if (error) {
    // Try direct query via fetch
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec_sql`;

    // Use pg directly via the management API
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL.replace('.supabase.co', '')}/v1/projects/${
        process.env.NEXT_PUBLIC_SUPABASE_URL.match(/\/\/([^.]+)\./)[1]
      }/database/query`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
        },
        body: JSON.stringify({ query: sql })
      }
    );

    if (!response.ok) {
      console.log('Direct API failed, trying statement-by-statement via supabase-js...');

      // Split and run each statement
      const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 10);
      for (const stmt of statements) {
        const { error: stmtErr } = await supabase.from('_sql').select().limit(0).throwOnError()
          .catch(async () => {
            return await supabase.rpc('exec', { query: stmt }).catch(e => ({ error: e }));
          });
      }

      console.log('Done. Check Supabase dashboard to confirm table creation.');
      console.log('\nIf the table was not created, run this SQL manually in the Supabase SQL Editor:');
      console.log(sql);
    } else {
      console.log('Migration applied successfully via management API.');
    }
  } else {
    console.log('Migration applied successfully.');
  }
}

run().catch(console.error);
