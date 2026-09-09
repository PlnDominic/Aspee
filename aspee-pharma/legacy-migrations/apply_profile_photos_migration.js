// Apply profile photos storage migration
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const migrationFile = path.join(__dirname, 'migration_profile_photos_storage.sql');

console.log('Applying profile photos storage migration...');

try {
  // Read the migration file
  const sql = fs.readFileSync(migrationFile, 'utf8');
  
  // Use Supabase CLI to run the migration
  execSync(`npx supabase db query "${sql.replace(/"/g, '\\"')}"`, {
    stdio: 'inherit',
    cwd: __dirname
  });
  
  console.log('✅ Avatar storage migration applied successfully!');
  console.log('📁 Storage bucket "avatar" created');
  console.log('🔓 Public access enabled for avatars');
  console.log('📸 Users can now upload avatars up to 2MB');
  
} catch (error) {
  console.error('❌ Failed to apply migration:', error.message);
  console.log('\nAlternative: Run this SQL manually in Supabase SQL editor:');
  console.log(`   ${migrationFile}`);
}