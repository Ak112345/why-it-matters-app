import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function inspectInstagramPosts() {
  console.log('🔍 Inspecting ALL Instagram posts...\n');

  // Get all Instagram posts regardless of status
  const { data: igPosts, error } = await supabase
    .from('posting_queue')
    .select('*')
    .eq('platform', 'instagram')
    .order('scheduled_for', { ascending: true });

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  if (!igPosts || igPosts.length === 0) {
    console.log('📭 No Instagram posts in queue');
    return;
  }

  console.log(`📬 Found ${igPosts.length} Instagram posts:\n`);

  igPosts.forEach((post, i) => {
    const scheduledDate = new Date(post.scheduled_for);
    const timestamp = scheduledDate.getTime();
    const isEpochZero = timestamp < 86400000; // Less than 1 day from epoch
    
    console.log(`${i + 1}. ${isEpochZero ? '🔴 BROKEN' : '✅'} Post ID: ${post.id}`);
    console.log(`   Status: ${post.status}`);
    console.log(`   Scheduled: ${post.scheduled_for} (${scheduledDate.toLocaleString()})`);
    console.log(`   Timestamp: ${timestamp}`);
    console.log(`   Video ID: ${post.final_video_id || 'NULL'}`);
    console.log(`   Caption: ${(post.caption || 'No caption').substring(0, 50)}...`);
    console.log(`   Error: ${post.error_message || 'None'}`);
    
    if (isEpochZero) {
      console.log(`   ⚠️  ACTION NEEDED: Delete this post (ID: ${post.id})`);
    }
    console.log('');
  });

  // Offer to delete broken posts
  const brokenPosts = igPosts.filter(post => {
    const timestamp = new Date(post.scheduled_for).getTime();
    return timestamp < 86400000;
  });

  if (brokenPosts.length > 0) {
    console.log(`\n🗑️  Deleting ${brokenPosts.length} broken Instagram posts...`);
    
    for (const post of brokenPosts) {
      const { error: delError } = await supabase
        .from('posting_queue')
        .delete()
        .eq('id', post.id);
      
      if (delError) {
        console.log(`   ❌ Failed to delete ${post.id}: ${delError.message}`);
      } else {
        console.log(`   ✅ Deleted ${post.id}`);
      }
    }
    
    console.log(`\n✅ Cleanup complete!`);
  }
}

inspectInstagramPosts();
