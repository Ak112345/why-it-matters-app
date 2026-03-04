import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function checkTables() {
  console.log('🔍 CHECKING ACTUAL TABLES\n');

  // Check videos table
  const { data: videos, error: vError } = await supabase
    .from('videos')
    .select('*')
    .limit(5);

  console.log('📹 VIDEOS TABLE:');
  if (vError) {
    console.log('  ❌ Error:', vError.message);
  } else {
    console.log('  Count:', videos?.length);
    if (videos && videos.length > 0) {
      console.log('  Columns:', Object.keys(videos[0]));
      console.log('  Sample statuses:', videos.map(v => v.status));
    }
  }

  // Check analysis table
  const { data: analyses, error: aError } = await supabase
    .from('analysis')
    .select('*')
    .limit(5);

  console.log('\n🧠 ANALYSIS TABLE:');
  if (aError) {
    console.log('  ❌ Error:', aError.message);
  } else {
    console.log('  Count:', analyses?.length);
    if (analyses && analyses.length > 0) {
      console.log('  Columns:', Object.keys(analyses[0]));
    }
  }

  // Check videos_final
  const { data: finalVideos, error: fError } = await supabase
    .from('videos_final')
    .select('*')
    .limit(5);

  console.log('\n🎬 VIDEOS_FINAL TABLE:');
  if (fError) {
    console.log('  ❌ Error:', fError.message);
  } else {
    console.log('  Count:', finalVideos?.length);
    if (finalVideos && finalVideos.length > 0) {
      console.log('  Columns:', Object.keys(finalVideos[0]));
      console.log('  Sample:', finalVideos[0]);
    }
  }

  // Check posting_queue
  const { data: queue, error: qError } = await supabase
    .from('posting_queue')
    .select('*')
    .limit(5);

  console.log('\n📤 POSTING_QUEUE TABLE:');
  if (qError) {
    console.log('  ❌ Error:', qError.message);
  } else {
    console.log('  Count:', queue?.length);
    if (queue && queue.length > 0) {
      console.log('  Columns:', Object.keys(queue[0]));
    }
  }

  // Get counts
  console.log('\n\n📊 TOTAL COUNTS:');
  
  const { count: videoCount } = await supabase
    .from('videos')
    .select('*', { count: 'exact', head: true });
  console.log('  Videos:', videoCount);

  const { count: analysisCount } = await supabase
    .from('analysis')
    .select('*', { count: 'exact', head: true });
  console.log('  Analyses:', analysisCount);

  const { count: finalCount } = await supabase
    .from('videos_final')
    .select('*', { count: 'exact', head: true });
  console.log('  Videos Final:', finalCount);

  const { count: queueCount } = await supabase
    .from('posting_queue')
    .select('*', { count: 'exact', head: true });
  console.log('  Posting Queue:', queueCount);
}

checkTables().catch(console.error);
