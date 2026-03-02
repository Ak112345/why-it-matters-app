#!/usr/bin/env node

/**
 * Run database migration via Supabase SQL API
 */

const fs = require('fs');
const path = require('path');

async function runMigration() {
  const migrationFile = process.argv[2] || '005_token_monitoring.sql';
  const migrationPath = path.join(__dirname, '..', 'migrations', migrationFile);

  if (!fs.existsSync(migrationPath)) {
    console.error(`Migration file not found: ${migrationPath}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(migrationPath, 'utf8');
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  console.log(`Running migration: ${migrationFile}`);

  // Split SQL into individual statements
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  let successCount = 0;
  let errorCount = 0;

  for (const statement of statements) {
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({ query: statement + ';' }),
      });

      if (res.ok) {
        successCount++;
        console.log(`✓ Statement ${successCount} executed`);
      } else {
        const error = await res.text();
        console.error(`✗ Statement failed:`, error);
        errorCount++;
      }
    } catch (err) {
      console.error(`✗ Error executing statement:`, err.message);
      errorCount++;
    }
  }

  console.log(`\nMigration complete: ${successCount} successful, ${errorCount} errors`);
  process.exit(errorCount > 0 ? 1 : 0);
}

runMigration().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
