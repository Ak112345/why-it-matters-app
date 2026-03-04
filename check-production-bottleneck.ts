import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkProductionPipeline() {
  console.log('🔍 CHECKING VIDEO PRODUCTION PIPELINE\n');
  console.log('='.repeat(70));

  // 1. Count segmented clips in storage
  console.log('\n📦 SEGMENTED CLIPS IN STORAGE:\n');
  
  const { data: segmentedClips, error: clipsError } = await supabase
    .storage
    .from('segmented_clips')
    .list('', { limit: 1000 });

  if (clipsError) {
    console.error('❌ Error reading segmented_clips:', clipsError);
  } else {
    const clipCount = segmentedClips?.length || 0;
    console.log(`✅ Total segmented clips in storage: ${clipCount}`);
    console.log(`   (Expected: 900+)`);
    if (clipCount > 0) {
      console.log(`\n   First 5 clips:`);
      segmentedClips?.slice(0, 5).forEach((clip, i) => {
        console.log(`   ${i + 1}. ${clip.name} (${clip.updated_at})`);
      });
    }
  }

  // 2. Check analysis table for videos awaiting production
  console.log('\n' + '='.repeat(70));
  console.log('\n📊 ANALYSIS RECORDS (videos awaiting video production):\n');

  const { data: analysisRecords } = await supabase
    .from('analysis')
    .select('id, hook, created_at, updated_at')
    .order('created_at', { ascending: false })
    .limit(5);

  console.log(`✅ Total analysis records: Check database`);
  if (analysisRecords?.length) {
    console.log(`\n   Recent analysis (last 5):`);
    analysisRecords.forEach((record, i) => {
      console.log(`   ${i + 1}. ID: ${record.id}`);
      console.log(`      Created: ${new Date(record.created_at).toLocaleString()}`);
      console.log(`      Hook: ${(record.hook || 'No hook').substring(0, 50)}...`);
    });
  }

  // 3. Check final_videos table
  console.log('\n' + '='.repeat(70));
  console.log('\n🎬 FINAL VIDEOS CREATED:\n');

  const { data: finalVideos } = await supabase
    .from('videos_final')
    .select('id, created_at, analysis_id, file_path')
    .order('created_at', { ascending: false });

  console.log(`✅ Total final videos: ${finalVideos?.length || 0}`);
  console.log(`   (Should be: 100s to 1000s based on clips)`);
  
  if (finalVideos?.length) {
    console.log(`\n   Recent final videos (last 3):`);
    finalVideos.slice(0, 3).forEach((video, i) => {
      console.log(`   ${i + 1}. ID: ${video.id}`);
      console.log(`      Created: ${new Date(video.created_at).toLocaleString()}`);
      console.log(`      Analysis ID: ${video.analysis_id || 'NULL'}`);
    });
  }

  // 4. Check video_production_jobs or similar logging
  console.log('\n' + '='.repeat(70));
  console.log('\n⚙️  VIDEO PRODUCTION STATUS:\n');

  // Try to find production errors
  const { data: recentAnalysis } = await supabase
    .from('analysis')
    .select('id')
    .order('created_at', { ascending: false })
    .limit(1);

  if (recentAnalysis?.length) {
    const latestAnalysisId = recentAnalysis[0].id;
    const { data: latestAnalysis } = await supabase
      .from('analysis')
      .select('*')
      .eq('id', latestAnalysisId)
      .single();

    if (latestAnalysis) {
      console.log(`Latest analysis record:`);
      console.log(`   ID: ${latestAnalysis.id}`);
      console.log(`   Created: ${new Date(latestAnalysis.created_at).toLocaleString()}`);
      console.log(`   Hook: ${(latestAnalysis.hook || 'None').substring(0, 60)}...`);
      
      // Check if this analysis has a corresponding final video
      const { data: correspondingVideo } = await supabase
        .from('videos_final')
        .select('id')
        .eq('analysis_id', latestAnalysis.id);

      if (correspondingVideo?.length) {
        console.log(`   ✅ Final video created: YES`);
      } else {
        console.log(`   ❌ Final video created: NO - BOTTLENECK HERE!`);
      }
    }
  }

  // 5. Check cron schedule
  console.log('\n' + '='.repeat(70));
  console.log('\n⏰ CRON SCHEDULE:\n');
  console.log(`   /api/content/generate: "0 6,14,22 * * *" (6 AM, 2 PM, 10 PM UTC)`);
  console.log(`   /api/produce: Check if this endpoint exists`);
  console.log(`   Current time: ${new Date().toLocaleString()} UTC`);

  // 6. Check for unprocessed videos ready to queue
  console.log('\n' + '='.repeat(70));
  console.log('\n📤 POSTING QUEUE STATUS:\n');

  const { data: queuedVideos } = await supabase
    .from('posting_queue')
    .select('id, platform, status')
    .eq('status', 'pending');

  const platformCounts: Record<string, number> = {};
  queuedVideos?.forEach(video => {
    platformCounts[video.platform] = (platformCounts[video.platform] || 0) + 1;
  });

  console.log(`Total queued posts: ${queuedVideos?.length || 0}`);
  Object.entries(platformCounts).forEach(([platform, count]) => {
    console.log(`   ${platform}: ${count}`);
  });

  // SUMMARY
  console.log('\n' + '='.repeat(70));
  console.log('\n🔴 CRITICAL FINDINGS:\n');
  
  const clipCount = segmentedClips?.length || 0;
  const finalVideoCount = finalVideos?.length || 1;
  const ratio = clipCount / finalVideoCount;

  console.log(`1. PRODUCTION BOTTLENECK DETECTED`);
  console.log(`   - Clips created: ${clipCount} (900+)`);
  console.log(`   - Final videos: ${finalVideoCount} (only 1!)`);
  console.log(`   - Ratio: 1 video per ${Math.round(ratio)} clips`);
  console.log(`   - Should be: Much higher production rate\n`);

  console.log(`2. MISSING OR STALLED PROCESS`);
  console.log(`   - Video production pipeline NOT running properly`);
  console.log(`   - /api/produce or produce cron may be missing/broken`);
  console.log(`   - Check: Is there a video production API endpoint?\n`);

  console.log(`3. ACTION NEEDED`);
  console.log(`   - Scale up final_videos generation`);
  console.log(`   - Run production pipeline NOW to catch up`);
  console.log(`   - Review video production logs/errors`);
}

checkProductionPipeline();
