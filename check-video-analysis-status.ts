import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkVideoAnalysisStatus() {
  console.log('📊 Video Analysis & Publishing Status\n');
  console.log('='.repeat(60));

  // Get yesterday's date
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);
  
  console.log(`\n📅 Checking for videos analyzed since: ${yesterday.toLocaleString()}\n`);

  // 1. Check analysis table (newly analyzed videos)
  const { data: recentAnalysis, error: analysisError } = await supabase
    .from('analysis')
    .select('id, hook, created_at')
    .gte('created_at', yesterday.toISOString())
    .order('created_at', { ascending: false })
    .limit(10);

  if (analysisError) {
    console.error('❌ Error fetching analysis:', analysisError);
  } else if (recentAnalysis?.length === 0) {
    console.log('📭 No new videos analyzed since yesterday');
  } else {
    console.log(`✅ Found ${recentAnalysis?.length} recently analyzed videos:\n`);
    recentAnalysis?.forEach((analysis, i) => {
      const createdAt = new Date(analysis.created_at);
      console.log(`   ${i + 1}. ID: ${analysis.id}`);
      console.log(`      Created: ${createdAt.toLocaleString()}`);
      console.log(`      Hook: ${(analysis.hook || 'No hook').substring(0, 60)}...`);
      console.log('');
    });
  }

  // 2. Check final_videos table (newly created videos)
  console.log('='.repeat(60));
  console.log('\n📹 Recently Created Final Videos:\n');

  const { data: recentVideos, error: videoError } = await supabase
    .from('videos_final')
    .select('id, created_at, file_path, analysis_id')
    .gte('created_at', yesterday.toISOString())
    .order('created_at', { ascending: false })
    .limit(10);

  if (videoError) {
    console.error('❌ Error fetching videos:', videoError);
  } else if (recentVideos?.length === 0) {
    console.log('📭 No videos added to final_videos since yesterday');
  } else {
    console.log(`✅ Found ${recentVideos?.length} videos added since yesterday:\n`);
    recentVideos?.forEach((video, i) => {
      const createdAt = new Date(video.created_at);
      console.log(`   ${i + 1}. Video ID: ${video.id}`);
      console.log(`      Created: ${createdAt.toLocaleString()}`);
      console.log(`      File: ${video.file_path?.split('/').pop() || 'No file'}`);
      console.log(`      Analysis ID: ${video.analysis_id || 'None'}`);
      console.log('');
    });
  }

  // 3. Check posting_queue status
  console.log('='.repeat(60));
  console.log('\n📤 Posting Queue Status:\n');

  // YouTube Shorts
  const { data: youtubeQueue } = await supabase
    .from('posting_queue')
    .select('*')
    .in('platform', ['youtube', 'youtube_shorts'])
    .eq('status', 'pending');

  console.log(`📺 YouTube Shorts: ${youtubeQueue?.length || 0} pending posts`);
  youtubeQueue?.slice(0, 3).forEach((post, i) => {
    const scheduledFor = new Date(post.scheduled_for);
    console.log(`   ${i + 1}. Scheduled: ${scheduledFor.toLocaleString()}`);
  });

  // Facebook
  const { data: facebookQueue } = await supabase
    .from('posting_queue')
    .select('*')
    .eq('platform', 'facebook')
    .eq('status', 'pending');

  console.log(`\n📄 Facebook: ${facebookQueue?.length || 0} pending posts`);
  facebookQueue?.slice(0, 3).forEach((post, i) => {
    const scheduledFor = new Date(post.scheduled_for);
    console.log(`   ${i + 1}. Scheduled: ${scheduledFor.toLocaleString()}`);
  });

  // Instagram
  const { data: instagramQueue } = await supabase
    .from('posting_queue')
    .select('*')
    .eq('platform', 'instagram')
    .eq('status', 'pending');

  console.log(`\n📷 Instagram: ${instagramQueue?.length || 0} pending posts`);
  instagramQueue?.slice(0, 3).forEach((post, i) => {
    const scheduledFor = new Date(post.scheduled_for);
    console.log(`   ${i + 1}. Scheduled: ${scheduledFor.toLocaleString()}`);
  });

  // TikTok
  const { data: tiktokQueue } = await supabase
    .from('posting_queue')
    .select('*')
    .eq('platform', 'tiktok')
    .eq('status', 'pending');

  console.log(`\n🎵 TikTok: ${tiktokQueue?.length || 0} pending posts`);
  tiktokQueue?.slice(0, 3).forEach((post, i) => {
    const scheduledFor = new Date(post.scheduled_for);
    console.log(`   ${i + 1}. Scheduled: ${scheduledFor.toLocaleString()}`);
  });

  // Total summary
  console.log('\n' + '='.repeat(60));
  const totalPending = (youtubeQueue?.length || 0) + (facebookQueue?.length || 0) + 
                       (instagramQueue?.length || 0) + (tiktokQueue?.length || 0);
  console.log(`\n📊 Total Pending Posts: ${totalPending}`);
  console.log(`📊 Recently Analyzed: ${recentAnalysis?.length || 0}`);
  console.log(`📊 Newly Created Videos: ${recentVideos?.length || 0}\n`);

  // Check if videos are ready to queue
  if (recentVideos && recentVideos.length > 0) {
    console.log('💡 Action: These videos could be added to the posting queue for YouTube/Facebook/Instagram/TikTok');
  }
}

checkVideoAnalysisStatus();
