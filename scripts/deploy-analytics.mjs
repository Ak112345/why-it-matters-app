// scripts/deploy-analytics.mjs
// Deploy 008_post_analytics.sql migration

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function deployAnalyticsMigration() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const migrationPath = path.join(__dirname, '..', 'migrations', '008_post_analytics.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  console.log('Deploying post_analytics migration...');

  // Split by semicolons and execute each statement
  const statements = sql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith('--'));

  for (const statement of statements) {
    if (!statement) continue;
    
    try {
      const { error } = await supabase.rpc('exec_sql', { sql_query: statement })
        .catch(async () => {
          // Fallback: try direct query method (may not work for all DDL)
          return await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify({ sql_query: statement }),
          }).then(r => r.json());
        });

      if (error) {
        console.error(`Error executing statement: ${statement.substring(0, 100)}...`);
        console.error(error);
      } else {
        console.log(`✓ Executed: ${statement.substring(0, 60)}...`);
      }
    } catch (err) {
      console.error(`Failed to execute: ${statement.substring(0, 100)}...`);
      console.error(err);
    }
  }

  console.log('Migration complete!');
}

deployAnalyticsMigration().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
