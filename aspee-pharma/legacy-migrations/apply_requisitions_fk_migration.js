// Prints the combined FK migration SQL for the requisitions table.
// Paste the output into: Supabase Dashboard → SQL Editor → New query → Run
//
// Run with: node apply_requisitions_fk_migration.js

const fs = require('fs');

const MIGRATIONS = [
  './supabase/migrations/20260521000100_requisitions_salesperson_system_users.sql',
  './supabase/migrations/20260521000101_requisitions_created_by_system_users.sql',
];

console.log('='.repeat(60));
console.log('ASPEE PHARMA — Requisitions FK Migration');
console.log('='.repeat(60));
console.log();
console.log('The Supabase JS client cannot run DDL directly.');
console.log('Copy the SQL below and paste it into:');
console.log('  Supabase Dashboard → SQL Editor → New query → Run');
console.log();
console.log('-'.repeat(60));
console.log('-- COMBINED MIGRATION SQL');
console.log('-'.repeat(60));
console.log();

for (const file of MIGRATIONS) {
  const sql = fs.readFileSync(file, 'utf8');
  console.log(`-- ${file}`);
  console.log(sql);
  console.log();
}

console.log('-'.repeat(60));
console.log('After running, sales requests will save without FK errors.');
