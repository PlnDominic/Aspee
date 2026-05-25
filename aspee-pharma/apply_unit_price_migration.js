// Fix: add unit_price to products and rebuild current_stock view.
// The Supabase JS client cannot run raw DDL — paste the SQL below
// directly into the Supabase SQL Editor to apply it.

const fs = require('fs');
const path = require('path');

const migrationPath = path.join(
  __dirname,
  'supabase/migrations/20260521000200_add_unit_price_to_products.sql'
);

const sql = fs.readFileSync(migrationPath, 'utf8');

console.log('=== Paste the following SQL into the Supabase SQL Editor ===\n');
console.log(sql);
console.log('\n=== End of migration SQL ===');
