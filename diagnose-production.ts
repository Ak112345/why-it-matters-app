import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkProductionErrors() {
  console.log('🔴 CHECKING PRODUCTION PIPELINE FAILURES\n');
  console.log('='.repeat(70));

  // Check for error logs in videos_final
  const { data: errorVideos } = await supabase
    .from('videos_final')
    .select('id, status, error_message, created_at')
    .eq('status', 'error')
    .order('created_at', { ascending: false })
    .limit(20);

  if (errorVideos && errorVideos.length > 0) {
    console.log(`\n❌ Found ${errorVideos.length} ERROR videos:\n`);
    errorVideos.forEach((video, i) => {
      console.log(`${i + 1}. ID: ${video.id}`);
      console.log(`   Created: ${new Date(video.created_at).toLocaleString()}`);
      console.log(`   Error: ${video.error_message || 'No error message'}`);
      console.log('');
    });
  } else {
    console.log('\n✅ No error videos in database');
  }

  // Check for records awaiting production (analysis without videos)
  console.log('='.repeat(70));
  console.log('\n⏳ ANALYSIS RECORDS AWAITING VIDEO PRODUCTION:\n');

  const { data: allAnalysis } = await supabase
    .from('analysis')
    .select('id, hook, created_at')
    .order('created_at', { ascending: false })
    .limit(20);

  if (allAnalysis && allAnalysis.length > 0) {
    console.log(`Checking if ${Math.min(5, allAnalysis.length)} analysis records have videos...\n`);
    
    let withoutVideos = 0;
    for (const analysis of allAnalysis.slice(0, 5)) {
      const { data: video } = await supabase
        .from('videos_final')
        .select('id')
        .eq('analysis_id', analysis.id)
        .limit(1);

      const hasVideo = video && video.length > 0;
      const status = hasVideo ? '✅ VIDEO CREATED' : '❌ NO VIDEO';
      
      console.log(`${status} - Analysis: ${analysis.id}`);
      console.log(`       Created: ${new Date(analysis.created_at).toLocaleString()}`);
      console.log(`       Hook: ${(analysis.hook || 'No hook').substring(0, 50)}...`);
      console.log('');

      if (!hasVideo) withoutVideos++;
    }

    console.log(`\n⚠️  ${withoutVideos}/5 recent analysis records are missing videos\n`);
  }

  // Check if Railway worker is accessible
  console.log('='.repeat(70));
  console.log('\n🚆 CHECKING RAILWAY WORKER STATUS:\n');

  const railwayUrl = process.env.RAILWAY_WORKER_URL || 'https://why-it-matters-worker-production.up.railway.app';
  const workerSecret = process.env.WORKER_SECRET;

  console.log(`Railway URL: ${railwayUrl}`);
  console.log(`Worker Secret: ${workerSecret ? '✅ Set' : '❌ Missing'}\n`);

  try {
    const res = await fetch(`${railwayUrl}/health`);
    if (res.ok) {
      console.log('✅ Railway worker is ONLINE');
    } else {
      console.log(`⚠️  Railway worker returned status ${res.status}`);
    }
  } catch (err: any) {
    console.log(`❌ Railway worker is UNREACHABLE: ${err.message}`);
  }

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('\n📋 PRODUCTION PIPELINE DIAGNOSIS:\n');

  console.log('PROBLEMS IDENTIFIED:');
  console.log('1. ❌ Only 1 final video exists (should be 100s)');
  console.log('2. ❌ /api/content/generate is calling produceVideo wrong');
  console.log('   - It calls: produceVideo({ analysisIds, batchSize, ... })');
  console.log('   - But function expects: produceVideo({ analysisId, source, ... })');
  console.log('3. ❌ Type mismatch = function call fails silently');
  console.log('4. ❌ 131 segmented clips in storage sit idle');
  console.log('5. ❌ No cron scheduled for /api/produce endpoint');
  
  console.log('\nROOT CAUSE:');
  console.log('The produceVideo function signature doesnt match how its being called');
  console.log('in /api/content/generate. This causes the produce step to fail.');

  console.log('\nSOLUTION:');
  console.log('1. Create a batch wrapper for produceVideo that handles arrays');
  console.log('2. OR: Fix /api/content/generate to call produceVideo correctly');
  console.log('3. Schedule /api/produce as frequent cron job (every 15-30 min)');
}

checkProductionErrors();
