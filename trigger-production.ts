import { produceVideo } from './src/production/produceVideo';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function triggerProduction() {
  console.log('🏭 TRIGGERING VIDEO PRODUCTION\n');

  // Get complete analyses that don't have videos yet
  const { data: analyses } = await supabase
    .from('analysis')
    .select('id, segment_id, hook')
    .eq('status', 'complete')
    .eq('approval_status', 'approved')
    .order('created_at', { ascending: true })
    .limit(50);

  console.log(`Found ${analyses?.length || 0} complete+approved analyses`);

  if (!analyses || analyses.length === 0) {
    console.log('No analyses ready for production!');
    return;
  }

  // Check which already have videos
  const analysisIds = analyses.map(a => a.id);
  const { data: existingVideos } = await supabase
    .from('videos_final')
    .select('analysis_id')
    .in('analysis_id', analysisIds);

  const existingSet = new Set((existingVideos || []).map((v: any) => v.analysis_id));
  const needProduction = analyses.filter(a => !existingSet.has(a.id));

  console.log(`${needProduction.length} need video production (${existingSet.size} already have videos)\n`);

  if (needProduction.length === 0) {
    console.log('✓ All analyses already have videos!');
    return;
  }

  console.log('🎬 Starting production for remaining videos...');
  console.log('(This will take several minutes as each video is processed)\n');

  const targetIds = needProduction.slice(0, 30).map(a => a.id);
  
  try {
    const results = await produceVideo({
      analysisIds: targetIds,
      batchSize: 10,
      delayBetweenBatches: 1000,
      addSubtitles: true,
      addHookOverlay: true,
    });

    console.log('\n✅ PRODUCTION COMPLETE');
    console.log('Results:', JSON.stringify(results, null, 2));
  } catch (error) {
    console.error('\n❌ PRODUCTION ERROR:', error);
    throw error;
  }
}

triggerProduction().catch(console.error);
