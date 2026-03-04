import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function checkPipelineStatus() {
  console.log('📊 PIPELINE STATUS CHECK\n');

  // Analyses
  const { count: analyzesPending } = await supabase
    .from('analysis')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');

  const { count: analyzesComplete } = await supabase
    .from('analysis')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'complete');

  console.log('🧠 ANALYSES:');
  console.log(`  Complete: ${analyzesComplete}`);
  console.log(`  Pending: ${analyzesPending}`);

  // Videos
  const { data: videos, count: videoCount } = await supabase
    .from('videos_final')
    .select('status', { count: 'exact' });

  const statusCounts = videos?.reduce((acc: any, v: any) => {
    acc[v.status] = (acc[v.status] || 0) + 1;
    return acc;
  }, {});

  console.log('\n🎬 VIDEOS (videos_final):');
  console.log(`  Total: ${videoCount}`);
  console.log(`  By status:`, statusCounts);

  // Posting queue
  const { data: queue, count: queueCount } = await supabase
    .from('posting_queue')
    .select('status,  platform', { count: 'exact' });

  const queueStatus = queue?.reduce((acc: any, q: any) => {
    acc[q.status] = (acc[q.status] || 0) + 1;
    return acc;
  }, {});

  console.log('\n📤 POSTING QUEUE:');
  console.log(`  Total: ${queueCount}`);
  console.log(`  By status:`, queueStatus);

  // Count pending videos vs queue
  const readyVideos = videos?.filter(v => v.status === 'ready').length || 0;
  const pendingQueue = queue?.filter((q: any) => q.status === 'pending').length || 0;

  console.log('\n🎯 PIPELINE FLOW:');
  console.log(`  ${analyzesComplete} analyses complete`);
  console.log(`  → ${videoCount} videos produced`);
  console.log(`  → ${pendingQueue} pending in posting queue`);
  console.log(`  → ${readyVideos} ready to be queued`);

  console.log('\n💡 NEXT STEPS:');
  if (videoCount && videoCount > 1) {
    console.log('  1. Wait for Railway worker to finish rendering (check Railway logs)');
    console.log('  2. Once videos are ready, run: POST /api/queue to add them to posting queue');
    console.log('  3. Videos will auto-post via /api/publish/cron (every 15 min)');
  }
}

checkPipelineStatus().catch(console.error);
