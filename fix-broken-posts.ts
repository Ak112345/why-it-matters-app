import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fixBrokenInstagramPosts() {
  console.log('🔍 Finding broken Instagram posts...\n');

  // Find posts with epoch 0 timestamp
  const { data: brokenPosts, error } = await supabase
    .from('posting_queue')
    .select('*')
    .eq('platform', 'instagram')
    .eq('status', 'pending')
    .lt('scheduled_for', '1971-01-01T00:00:00Z');

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  if (!brokenPosts || brokenPosts.length === 0) {
    console.log('✅ No broken Instagram posts found');
    return;
  }

  console.log(`❌ Found ${brokenPosts.length} broken Instagram posts\n`);

  brokenPosts.forEach((post, i) => {
    console.log(`   ${i + 1}. ID: ${post.id}`);
    console.log(`      Platform: ${post.platform}`);
    console.log(`      Scheduled: ${post.scheduled_for}`);
    console.log(`      Video ID: ${post.final_video_id || 'NULL'}`);
    console.log(`      Caption: ${(post.caption || '').substring(0, 60)}...`);
    console.log('');
  });

  // Delete these broken posts
  console.log('🗑️  Deleting broken posts...\n');

  const { error: deleteError } = await supabase
    .from('posting_queue')
    .delete()
    .eq('platform', 'instagram')
    .eq('status', 'pending')
    .lt('scheduled_for', '1971-01-01T00:00:00Z');

  if (deleteError) {
    console.error('❌ Delete error:', deleteError);
  } else {
    console.log(`✅ Deleted ${brokenPosts.length} broken Instagram posts`);
    console.log('   These posts had invalid timestamps and would have blocked the queue.\n');
  }

  // Show remaining posts
  const { data: remaining } = await supabase
    .from('posting_queue')
    .select('id, platform, status, scheduled_for')
    .eq('status', 'pending')
    .order('scheduled_for', { ascending: true });

  if (remaining && remaining.length > 0) {
    console.log(`\n✅ ${remaining.length} valid pending posts remain:`);
    remaining.forEach(post => {
      const scheduledFor = new Date(post.scheduled_for);
      console.log(`   - ${post.platform}: ${scheduledFor.toLocaleString()}`);
    });
  }
}

fixBrokenInstagramPosts();
