const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectSales() {
  console.log("Inspecting sales_invoices...");
  let { data: invoices, error: invError } = await supabase.from('sales_invoices').select('*').limit(1);
  console.log("Invoices error:", invError);
  if (invoices && invoices.length > 0) console.log("Invoice structure:", Object.keys(invoices[0]));

  console.log("\nInspecting sales_receipts...");
  let { data: receipts, error: recError } = await supabase.from('sales_receipts').select('*').limit(1);
  console.log("Receipts error:", recError);
  if (receipts && receipts.length > 0) console.log("Receipt structure:", Object.keys(receipts[0]));

  console.log("\nInspecting credit_notes...");
  let { data: notes, error: notesError } = await supabase.from('credit_notes').select('*').limit(1);
  console.log("Credit notes error:", notesError);
  if (notes && notes.length > 0) console.log("Credit note structure:", Object.keys(notes[0]));
  else if (notesError?.code === '42P01') console.log("Table credit_notes does not exist.");

  console.log("\nInspecting sales_returns...");
  let { data: returns, error: retError } = await supabase.from('sales_returns').select('*').limit(1);
  console.log("Sales returns error:", retError);
  if (returns && returns.length > 0) console.log("Sales return structure:", Object.keys(returns[0]));
  else if (retError?.code === '42P01') console.log("Table sales_returns does not exist.");

  console.log("\nInspecting price_lists...");
  let { data: priceLists, error: plError } = await supabase.from('price_lists').select('*').limit(1);
  console.log("Price lists error:", plError);
  if (priceLists && priceLists.length > 0) console.log("Price list structure:", Object.keys(priceLists[0]));
  else if (plError?.code === '42P01') console.log("Table price_lists does not exist.");

}

inspectSales();
