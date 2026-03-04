import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function checkVideosDetailed() {
  console.log('🔍 DETAILED VIDEO CHECK\n');

  // Get ALL videos with all statuses
  const { data: allVideos, count } = await supabase
    .from('videos_final')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false });

  console.log(`Total videos in videos_final: ${count}\n`);

  if (allVideos && allVideos.length > 0) {
    console.log('Recent videos:');
    allVideos.slice(0, 20).forEach((v: any) => {
      console.log(`  ${v.id.substring(0, 8)}: status=${v.status}, created=${v.created_at}, error=${v.error_message?.substring(0, 50) || 'none'}`);
    });

    // Group by status
    const statusGroups = allVideos.reduce((acc: any, v: any) => {
      acc[v.status] = (acc[v.status] || 0) + 1;
      return acc;
    }, {});
    console.log('\nStatus breakdown:', statusGroups);

    // Check for errors
    const errored = allVideos.filter(v => v.error_message);
    if (errored.length > 0) {
      console.log(`\n⚠️  ${errored.length} videos with errors:`);
      errored.slice(0, 5).forEach((v: any) => {
        console.log(`  ${v.id.substring(0, 8)}: ${v.error_message.substring(0, 100)}`);
      });
    }
  }

  console.log('\n💡 The Railway worker creates records in videos_final when it starts rendering.');
  console.log('   If we only see 1 video, the other 60 jobs may not have started yet.');
  console.log('   Check Railway logs: https://railway.app/dashboard');
}

checkVideosDetailed().catch(console.error);
