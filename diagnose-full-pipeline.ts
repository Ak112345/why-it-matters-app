import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function diagnose() {
  console.log('🔍 FULL PIPELINE DIAGNOSIS\n');

  // 1. Raw clips
  const { data: rawClips, error: rawError } = await supabase
    .from('clips')
    .select('id, status, created_at')
    .order('created_at', { ascending: false });

  console.log('📹 RAW CLIPS:');
  if (rawError) {
    console.log('  ❌ Error:', rawError.message);
  } else {
    const statusCounts = rawClips?.reduce((acc: any, clip: any) => {
      acc[clip.status] = (acc[clip.status] || 0) + 1;
      return acc;
    }, {});
    console.log('  Total:', rawClips?.length);
    console.log('  By Status:', statusCounts);
  }

  // 2. Segmented clips
  const { data: segments, error: segError } = await supabase
    .from('segments')
    .select('id, status, created_at')
    .order('created_at', { ascending: false });

  console.log('\n✂️  SEGMENTED CLIPS:');
  if (segError) {
    console.log('  ❌ Error:', segError.message);
  } else {
    const statusCounts = segments?.reduce((acc: any, seg: any) => {
      acc[seg.status] = (acc[seg.status] || 0) + 1;
      return acc;
    }, {});
    console.log('  Total:', segments?.length);
    console.log('  By Status:', statusCounts);
  }

  // 3. Analysis
  const { data: analyses, error: analysisError } = await supabase
    .from('analysis')
    .select('id, status, created_at, error_message')
    .order('created_at', { ascending: false });

  console.log('\n🧠 ANALYZED CLIPS:');
  if (analysisError) {
    console.log('  ❌ Error:', analysisError.message);
  } else {
    const statusCounts = analyses?.reduce((acc: any, a: any) => {
      acc[a.status] = (acc[a.status] || 0) + 1;
      return acc;
    }, {});
    console.log('  Total:', analyses?.length);
    console.log('  By Status:', statusCounts);
    
    const errored = analyses?.filter((a: any) => a.error_message);
    if (errored && errored.length > 0) {
      console.log('\n  ⚠️  Recent Errors:');
      errored.slice(0, 5).forEach((a: any) => {
        console.log(`    - ${a.id}: ${a.error_message?.substring(0, 80)}...`);
      });
    }
  }

  // 4. Videos Final (produced)
  const { data: finalVideos, error: finalError } = await supabase
    .from('videos_final')
    .select('id, status, has_subtitles, error_message, created_at')
    .order('created_at', { ascending: false });

  console.log('\n🎬 PRODUCED VIDEOS (videos_final):');
  if (finalError) {
    console.log('  ❌ Error:', finalError.message);
  } else {
    const statusCounts = finalVideos?.reduce((acc: any, v: any) => {
      acc[v.status] = (acc[v.status] || 0) + 1;
      return acc;
    }, {});
    console.log('  Total:', finalVideos?.length);
    console.log('  By Status:', statusCounts);
    
    const withSubtitles = finalVideos?.filter((v: any) => v.has_subtitles).length;
    console.log('  With Subtitles:', withSubtitles);
    
    const errored = finalVideos?.filter((v: any) => v.error_message);
    if (errored && errored.length > 0) {
      console.log('\n  ⚠️  Recent Errors:');
      errored.slice(0, 5).forEach((v: any) => {
        console.log(`    - ${v.id}: ${v.error_message?.substring(0, 80)}...`);
      });
    }
  }

  // 5. Posting Queue
  const { data: queue, error: queueError } = await supabase
    .from('posting_queue')
    .select('id, status, platform, scheduled_post_time, created_at')
    .order('created_at', { ascending: false });

  console.log('\n📤 POSTING QUEUE:');
  if (queueError) {
    console.log('  ❌ Error:', queueError.message);
  } else {
    const statusCounts = queue?.reduce((acc: any, q: any) => {
      acc[q.status] = (acc[q.status] || 0) + 1;
      return acc;
    }, {});
    console.log('  Total:', queue?.length);
    console.log('  By Status:', statusCounts);
    
    const platformCounts = queue?.reduce((acc: any, q: any) => {
      acc[q.platform] = (acc[q.platform] || 0) + 1;
      return acc;
    }, {});
    console.log('  By Platform:', platformCounts);

    const pending = queue?.filter((q: any) => q.status === 'pending');
    const now = new Date();
    const due = pending?.filter((q: any) => new Date(q.scheduled_post_time) <= now);
    console.log('  Pending & Due:', due?.length);
  }

  // 6. Check for blocking issues
  console.log('\n🚨 BLOCKING ISSUES:');
  
  // Check if segments are not being analyzed
  const pendingSegments = segments?.filter((s: any) => s.status === 'pending')?.length || 0;
  if (pendingSegments > 0) {
    console.log(`  ⚠️  ${pendingSegments} segments with status 'pending' - should be analyzed`);
  }

  // Check if analyses are complete but not produced
  const completeAnalyses = analyses?.filter((a: any) => a.status === 'complete')?.length || 0;
  const producedCount = finalVideos?.length || 0;
  if (completeAnalyses > producedCount) {
    console.log(`  ⚠️  ${completeAnalyses} complete analyses but only ${producedCount} produced videos - production may be blocked`);
  }

  // Check if produced videos not in queue
  const readyVideos = finalVideos?.filter((v: any) => v.status === 'ready')?.length || 0;
  const queuedCount = queue?.length || 0;
  if (readyVideos > queuedCount) {
    console.log(`  ⚠️  ${readyVideos} ready videos but only ${queuedCount} in queue - queueing may be blocked`);
  }

  console.log('\n✅ Diagnosis complete');
}

diagnose().catch(console.error);
