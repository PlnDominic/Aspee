// Fix sales_receipts ↔ sales_invoices relationship
// Adds missing invoice_number column and reloads PostgREST schema cache
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  console.log('1. Adding invoice_number column to sales_receipts...');

  const { error: alterError } = await supabase.rpc('exec_sql', {
    sql: `ALTER TABLE public.sales_receipts ADD COLUMN IF NOT EXISTS invoice_number TEXT;`
  });

  if (alterError) {
    console.log('RPC exec_sql not available, printing SQL to run manually.');
    console.log('\n--- Run this in Supabase SQL Editor ---\n');
    console.log(`
ALTER TABLE public.sales_receipts ADD COLUMN IF NOT EXISTS invoice_number TEXT;

UPDATE public.sales_receipts sr
SET invoice_number = si.invoice_number
FROM public.sales_invoices si
WHERE sr.invoice_id = si.id
  AND sr.invoice_number IS NULL;

CREATE INDEX IF NOT EXISTS idx_sales_receipts_invoice_number
ON public.sales_receipts(invoice_number);

NOTIFY pgrst, 'reload schema';
    `);
    console.log('--- End SQL ---\n');
    return;
  }

  console.log('   ✓ Column added');

  console.log('2. Backfilling invoice_number from sales_invoices...');
  const { error: updateError } = await supabase.rpc('exec_sql', {
    sql: `
      UPDATE public.sales_receipts sr
      SET invoice_number = si.invoice_number
      FROM public.sales_invoices si
      WHERE sr.invoice_id = si.id
        AND sr.invoice_number IS NULL;
    `
  });
  if (updateError) console.log('   Warning:', updateError.message);
  else console.log('   ✓ Backfill complete');

  console.log('3. Creating index...');
  const { error: indexError } = await supabase.rpc('exec_sql', {
    sql: `CREATE INDEX IF NOT EXISTS idx_sales_receipts_invoice_number ON public.sales_receipts(invoice_number);`
  });
  if (indexError) console.log('   Warning:', indexError.message);
  else console.log('   ✓ Index created');

  console.log('4. Reloading PostgREST schema cache...');
  const { error: notifyError } = await supabase.rpc('exec_sql', {
    sql: `NOTIFY pgrst, 'reload schema';`
  });
  if (notifyError) console.log('   Warning:', notifyError.message);
  else console.log('   ✓ Schema cache reloaded');

  console.log('\nDone! The relationship error should be resolved.');
}

run().catch(console.error);
