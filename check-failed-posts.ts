import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkFailedPosts() {
  console.log('🔍 Checking recent failed posts...\n');

  // Get failed posts
  const { data: failedPosts, error: failedError } = await supabase
    .from('posting_queue')
    .select('*')
    .eq('status', 'failed')
    .order('created_at', { ascending: false })
    .limit(10);

  if (failedError) {
    console.error('❌ Error fetching failed posts:', failedError);
    return;
  }

  if (!failedPosts || failedPosts.length === 0) {
    console.log('✅ No failed posts found!');
  } else {
    console.log(`❌ Found ${failedPosts.length} failed posts:\n`);
    
    // Group by platform and error
    const byPlatform: Record<string, any[]> = {};
    const errorPatterns: Record<string, number> = {};

    failedPosts.forEach(post => {
      const platform = post.platform || 'unknown';
      if (!byPlatform[platform]) byPlatform[platform] = [];
      byPlatform[platform].push(post);

      // Track error patterns
      const error = post.error_message || 'Unknown error';
      const key = error.substring(0, 100); // First 100 chars
      errorPatterns[key] = (errorPatterns[key] || 0) + 1;
    });

    // Show by platform
    console.log('📊 Failed Posts by Platform:');
    Object.keys(byPlatform).forEach(platform => {
      console.log(`   ${platform}: ${byPlatform[platform].length} failures`);
    });

    console.log('\n🔴 Most Common Errors:');
    const sortedErrors = Object.entries(errorPatterns)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    
    sortedErrors.forEach(([error, count]) => {
      console.log(`   [${count}x] ${error}`);
    });

    console.log('\n📝 Recent Failures (last 5):');
    failedPosts.slice(0, 5).forEach((post, i) => {
      console.log(`\n   ${i + 1}. ID: ${post.id}`);
      console.log(`      Platform: ${post.platform}`);
      console.log(`      Created: ${new Date(post.created_at).toLocaleString()}`);
      console.log(`      Scheduled: ${new Date(post.scheduled_for).toLocaleString()}`);
      console.log(`      Error: ${post.error_message || 'None'}`);
      console.log(`      Video ID: ${post.final_video_id || 'None'}`);
    });
  }

  // Check pending posts
  console.log('\n\n⏳ Checking pending posts...\n');
  
  const { data: pendingPosts, error: pendingError } = await supabase
    .from('posting_queue')
    .select('*')
    .eq('status', 'pending')
    .order('scheduled_for', { ascending: true })
    .limit(10);

  if (pendingError) {
    console.error('❌ Error fetching pending posts:', pendingError);
    return;
  }

  if (!pendingPosts || pendingPosts.length === 0) {
    console.log('📭 No pending posts in queue');
  } else {
    console.log(`📬 Found ${pendingPosts.length} pending posts:\n`);
    
    const now = new Date();
    pendingPosts.forEach((post, i) => {
      const scheduledFor = new Date(post.scheduled_for);
      const isDue = scheduledFor <= now;
      const timeUntil = Math.round((scheduledFor.getTime() - now.getTime()) / 1000 / 60);
      
      console.log(`   ${i + 1}. ${isDue ? '🔴 DUE NOW' : '⏰'} Platform: ${post.platform}`);
      console.log(`      Scheduled: ${scheduledFor.toLocaleString()}`);
      if (isDue) {
        console.log(`      ⚠️  OVERDUE by ${Math.abs(timeUntil)} minutes`);
      } else {
        console.log(`      Time until: ${timeUntil} minutes`);
      }
      console.log(`      Video ID: ${post.final_video_id || 'None'}`);
      console.log(`      Caption: ${(post.caption || '').substring(0, 60)}...`);
      console.log('');
    });
  }

  // Check video accessibility
  console.log('\n\n🎥 Checking video file accessibility...\n');
  
  const { data: recentVideos, error: videoError } = await supabase
    .from('videos_final')
    .select('id, file_path, created_at')
    .order('created_at', { ascending: false })
    .limit(3);

  if (videoError) {
    console.error('❌ Error fetching videos:', videoError);
    return;
  }

  if (recentVideos && recentVideos.length > 0) {
    console.log(`Found ${recentVideos.length} recent videos:\n`);
    
    for (const video of recentVideos) {
      console.log(`   Video ID: ${video.id}`);
      console.log(`   URL: ${video.file_path}`);
      
      // Test if URL is accessible
      if (video.file_path) {
        try {
          const res = await fetch(video.file_path, { method: 'HEAD' });
          if (res.ok) {
            const size = res.headers.get('content-length');
            console.log(`   ✅ Accessible (${size ? Math.round(parseInt(size) / 1024 / 1024) + 'MB' : 'unknown size'})`);
          } else {
            console.log(`   ❌ Not accessible (Status: ${res.status})`);
          }
        } catch (err: any) {
          console.log(`   ❌ Error accessing: ${err.message}`);
        }
      } else {
        console.log(`   ⚠️  No file path`);
      }
      console.log('');
    }
  }
}

checkFailedPosts();
