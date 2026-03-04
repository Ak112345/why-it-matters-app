import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function diagnoseProduction() {
  console.log('🔍 PRODUCTION BOTTLENECK ANALYSIS\n');

  // Check analysis statuses
  const { data: analyses } = await supabase
    .from('analysis')
    .select('id, status, approval_status, content_status, video_id, segment_id')
    .order('created_at', { ascending: false });

  const statusCounts = analyses?.reduce((acc: any, a: any) => {
    const key = `${a.status} / ${a.approval_status} / ${a.content_status}`;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  console.log('🧠 ANALYSIS STATUS BREAKDOWN:');
  console.log('  Total:', analyses?.length);
  console.log('  Status combinations:');
  Object.entries(statusCounts || {}).forEach(([status, count]) => {
    console.log(`    ${status}: ${count}`);
  });

  // Find analyses that should be produced
  const readyForProduction = analyses?.filter((a: any) => 
    a.status === 'complete' && 
    a.approval_status === 'approved' &&
    !a.video_id // No video produced yet
  );

  console.log('\n  ✅ Ready for production:', readyForProduction?.length);
  console.log('     (status=complete, approval_status=approved, no video_id)');

  if (readyForProduction && readyForProduction.length > 0) {
    console.log('\n  🎯 Sample IDs ready for production:');
    readyForProduction.slice(0, 10).forEach((a: any) => {
      console.log(`    - Analysis: ${a.id}, Segment: ${a.segment_id}`);
    });
  }

  // Check posting queue content
  const { data: queue } = await supabase
    .from('posting_queue')
    .select('*')
    .order('created_at', { ascending: false });

  console.log('\n📤 POSTING QUEUE ANALYSIS:');
  console.log('  Total items:', queue?.length);
  
  const typeCount = queue?.reduce((acc: any, q: any) => {
    acc[q.type || 'unknown'] = (acc[q.type || 'unknown'] || 0) + 1;
    return acc;
  }, {});
  console.log('  By type:', typeCount);

  const statusCount = queue?.reduce((acc: any, q: any) => {
    acc[q.status] = (acc[q.status] || 0) + 1;
    return acc;
  }, {});
  console.log('  By status:', statusCount);

  const videoQueue = queue?.filter(q => q.final_video_id);
  console.log('  Items with final_video_id:', videoQueue?.length);

  // Check if production API endpoint has been called
  console.log('\n🏭 PRODUCTION CHECK:');
  console.log(`  Analyses ready: ${readyForProduction?.length}`);
  console.log(`  Videos produced: 1`);
  console.log(`  ⚠️  GAP: ${(readyForProduction?.length || 0)} analyses not produced!`);

  console.log('\n💡 SOLUTION:');
  console.log('  The /api/produce endpoint needs to run to convert analyses → videos');
  console.log('  Cron schedule: every 30 minutes');
  console.log('  Manual trigger: POST /api/produce');
}

diagnoseProduction().catch(console.error);
