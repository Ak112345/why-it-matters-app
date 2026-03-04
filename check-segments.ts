import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function checkSegments() {
  console.log('🔍 CHECKING SEGMENT TABLES\n');

  // Check clips_raw
  const { data: rawClips, error: rawError, count: rawCount } = await supabase
    .from('clips_raw')
    .select('*', { count: 'exact', head: false })
    .limit(3);

  console.log('📹 clips_raw:');
  if (rawError) {
    console.log('  ❌ Error:', rawError.message);
  } else {
    console.log('  Total count:', rawCount);
    if (rawClips && rawClips.length > 0) {
      console.log('  Columns:', Object.keys(rawClips[0]));
      console.log('  Sample IDs:', rawClips.map((c: any) => c.id).slice(0, 3));
    }
  }

  // Check clips_segmented
  const { data: segmented, error: segError, count: segCount } = await supabase
    .from('clips_segmented')
    .select('*', { count: 'exact', head: false })
    .limit(3);

  console.log('\n✂️  clips_segmented:');
  if (segError) {
    console.log('  ❌ Error:', segError.message);
  } else {
    console.log('  Total count:', segCount);
    if (segmented && segmented.length > 0) {
      console.log('  Columns:', Object.keys(segmented[0]));
      console.log('  Sample:', segmented[0]);
    }
  }

  // Cross-check: Do the analyses reference segments that exist?
  console.log('\n🔗 ANALYSIS ← → SEGMENT LINKAGE:');
  const { data: analyses } = await supabase
    .from('analysis')
    .select('id, segment_id, status')
    .limit(5);

  if (analyses && analyses.length > 0) {
    console.log(`  Checking ${analyses.length} sample analyses...`);
    for (const analysis of analyses) {
      const { data: seg } = await supabase
        .from('clips_segmented')
        .select('id, raw_clip_id')
        .eq('id', analysis.segment_id)
        .single();

      if (seg) {
        console.log(`  ✓ Analysis ${analysis.id} → Segment ${seg.id} (exists)`);
      } else {
        console.log(`  ❌ Analysis ${analysis.id} → Segment ${analysis.segment_id} (NOT FOUND)`);
      }
    }
  }

  console.log('\n💡 NEXT STEP:');
  console.log('  Try manually triggering: POST /api/analyze with { batchSize: 5 }');
  console.log('  Or check if analysis cron is running');
}

checkSegments().catch(console.error);
