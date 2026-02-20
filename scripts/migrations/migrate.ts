import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

/**
 * Supabase Database Migration Runner
 * 
 * This script applies all content management database migrations
 * to your Supabase PostgreSQL database.
 * 
 * Usage: npx ts-node scripts/migrations/migrate.ts
 * 
 * Environment Variables Required:
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 */

interface MigrationResult {
  file: string;
  success: boolean;
  duration: number;
  error?: string;
}

const MIGRATIONS = [
  '001_create_content_direction_table.sql',
  '002_create_review_tasks_table.sql',
  '003_create_video_performance_table.sql',
];

async function runMigration(client: any, filePath: string): Promise<MigrationResult> {
  const startTime = Date.now();
  const fileName = path.basename(filePath);

  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Migration file not found: ${filePath}`);
    }

    const sql = fs.readFileSync(filePath, 'utf-8');

    // Execute the SQL
    const { error } = await client.rpc('execute_sql', {
      sql,
    });

    if (error) {
      return {
        file: fileName,
        success: false,
        duration: Date.now() - startTime,
        error: error.message,
      };
    }

    return {
      file: fileName,
      success: true,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    return {
      file: fileName,
      success: false,
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function main() {
  console.log('🔄 Why It Matters - Database Migration Runner');
  console.log('='.repeat(50));
  console.log('');

  // Check environment variables
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Error: Missing required environment variables');
    console.error('   SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
    console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? '✓' : '✗');
    process.exit(1);
  }

  console.log('✓ Environment variables configured');
  console.log(`✓ Supabase URL: ${supabaseUrl}`);
  console.log('');

  // Create Supabase client
  let client: any;
  try {
    client = createClient(supabaseUrl, supabaseKey);
    console.log('✓ Connected to Supabase');
  } catch (error) {
    console.error('❌ Failed to connect to Supabase');
    console.error(error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }

  console.log('');
  console.log('🗄️  Starting database migrations...');
  console.log('');

  const results: MigrationResult[] = [];
  const migrationsDir = path.dirname(__filename);

  for (const migration of MIGRATIONS) {
    const filePath = path.join(migrationsDir, migration);
    console.log(`📄 Running: ${migration}`);

    const result = await runMigration(client, filePath);
    results.push(result);

    if (result.success) {
      console.log(`   ✓ Success (${result.duration}ms)`);
    } else {
      console.log(`   ✗ Failed: ${result.error}`);
    }
    console.log('');
  }

  // Summary
  console.log('='.repeat(50));
  console.log('Migration Summary:');
  console.log('');

  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

  console.log(`✓ Successful: ${successful}/${results.length}`);
  console.log(`✗ Failed: ${failed}/${results.length}`);
  console.log(`⏱️  Total time: ${totalDuration}ms`);
  console.log('');

  if (failed > 0) {
    console.log('⚠️  Failed migrations:');
    results.filter((r) => !r.success).forEach((r) => {
      console.log(`   - ${r.file}: ${r.error}`);
    });
    process.exit(1);
  }

  console.log('✅ All migrations completed successfully!');
  console.log('');
  console.log('📊 Next steps:');
  console.log('1. Verify tables in Supabase SQL Editor:');
  console.log('   SELECT table_name FROM information_schema.tables');
  console.log("   WHERE table_schema = 'public'");
  console.log("   AND table_name IN ('content_direction', 'review_tasks', 'video_performance');");
  console.log('');
  console.log('2. Start the API server:');
  console.log('   npm run dev');
  console.log('');
}

main().catch((error) => {
  console.error('❌ Migration failed:', error);
  process.exit(1);
});
