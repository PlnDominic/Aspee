const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectSales() {
  const result = {};

  let { data: invoices, error: invError } = await supabase.from('sales_invoices').select('*').limit(1);
  result.invoices = invError ? { error: invError } : Object.keys(invoices[0] || {});

  let { data: receipts, error: recError } = await supabase.from('sales_receipts').select('*').limit(1);
  result.receipts = recError ? { error: recError } : Object.keys(receipts[0] || {});

  let { data: notes, error: notesError } = await supabase.from('credit_notes').select('*').limit(1);
  result.creditNotes = notesError ? { error: notesError } : Object.keys(notes[0] || {});

  let { data: returns, error: retError } = await supabase.from('sales_returns').select('*').limit(1);
  result.salesReturns = retError ? { error: retError } : Object.keys(returns[0] || {});

  let { data: pl, error: plError } = await supabase.from('price_lists').select('*').limit(1);
  result.priceLists = plError ? { error: plError } : Object.keys(pl[0] || {});

  fs.writeFileSync('sales_inspection.json', JSON.stringify(result, null, 2));
}

inspectSales().catch(err => {
    fs.writeFileSync('sales_inspection.json', JSON.stringify({ error: err.message }));
});
