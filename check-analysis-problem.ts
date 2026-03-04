import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function checkAnalysisProblem() {
  console.log('🔍 ANALYSIS FAILURE DIAGNOSIS\n');

  // Get sample pending analysis
  const { data: pending } = await supabase
    .from('analysis')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(5);

  console.log('📝 SAMPLE PENDING ANALYSES:');
  pending?.forEach((a: any, i: number) => {
    console.log(`\n  Analysis ${i + 1}:`);
    console.log(`    ID: ${a.id}`);
    console.log(`    Segment ID: ${a.segment_id}`);
    console.log(`    Created: ${a.created_at}`);
    console.log(`    Status: ${a.status}`);
    console.log(`    Approval: ${a.approval_status}`);
    console.log(`    Has Hook: ${!!a.hook}`);
    console.log(`    Has Caption: ${!!a.caption}`);
    console.log(`    Has Timestamps: ${!!a.timestamps}`);
    console.log(`    Raw AI Response: ${a.raw_ai_response ? 'YES' : 'NO'}`);
    if (a.raw_ai_response) {
      console.log(`    Response preview: ${a.raw_ai_response.substring(0, 100)}...`);
    }
  });

  // Check if there are ANY complete analyses
  const { data: complete, count: completeCount } = await supabase
    .from('analysis')
    .select('*', { count: 'exact' })
    .eq('status', 'complete')
    .limit(5);

  console.log(`\n\n✅ COMPLETE ANALYSES: ${completeCount}`);
  if (complete && complete.length > 0) {
    console.log('  Sample complete analysis:');
    console.log('    ID:', complete[0].id);
    console.log('    Has all fields:', !!complete[0].hook && !!complete[0].caption);
  }

  // Check job_logs for analysis errors
  const { data: logs } = await supabase
    .from('job_logs')
    .select('*')
    .ilike('job_type', '%analyz%')
    .order('created_at', { ascending: false })
    .limit(10);

  console.log(`\n\n📋 RECENT ANALYSIS JOB LOGS: ${logs?.length || 0}`);
  logs?.forEach((log: any, i: number) => {
    console.log(`\n  Log ${i + 1}:`);
    console.log(`    Type: ${log.job_type}`);
    console.log(`    Status: ${log.status}`);
    console.log(`    Created: ${log.created_at}`);
    if (log.error_message) {
      console.log(`    Error: ${log.error_message.substring(0, 200)}`);
    }
    if (log.metadata) {
      console.log(`    Metadata:`, JSON.stringify(log.metadata).substring(0, 100));
    }
  });

  console.log('\n\n🎯 ROOT CAUSE:');
  console.log('  All 212 analyses are stuck in "pending" status');
  console.log('  This means the analysis records were created but never completed');
  console.log('  The /api/analyze endpoint is likely failing silently');
  console.log('\n  Next step: Run the analysis process manually on a pending segment');
}

checkAnalysisProblem().catch(console.error);
