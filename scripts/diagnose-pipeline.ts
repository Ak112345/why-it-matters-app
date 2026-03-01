#!/usr/bin/env node

/**
 * Diagnose pipeline status
 * Run with: pnpm diagnose:pipeline
 * Environment variables:
 *   DIAGNOSE_QUERY_LIMIT - max records per query (default: 300)
 *   DIAGNOSE_TIMEOUT_MS - query timeout in milliseconds (default: 20000)
 */

import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.NEXT_SUPABASE_SERVICE_ROLE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_URL or service role key environment variable.');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const DIAG_LIMIT = Number(process.env.DIAGNOSE_QUERY_LIMIT ?? 300);
const DIAG_TIMEOUT_MS = Number(process.env.DIAGNOSE_TIMEOUT_MS ?? 20000);

async function withTimeout(task: any) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DIAG_TIMEOUT_MS);

  try {
    return await task(controller.signal);
  } finally {
    clearTimeout(timeout);
  }
}

function formatQueryError(error: { message: string; name?: string }) {
  if (error?.name === 'AbortError') {
    return `Query timed out after ${DIAG_TIMEOUT_MS}ms. Increase DIAGNOSE_TIMEOUT_MS or lower DIAGNOSE_QUERY_LIMIT.`;
  }
  return error.message;
}

async function diagnose() {
  console.log('🔍 Diagnosing Pipeline Status...\n');
  console.log(`Using query limit=${DIAG_LIMIT}, timeout=${DIAG_TIMEOUT_MS}ms\n`);

  try {
    // Check raw clips
    console.log('📦 Checking raw clips...');
    const { data: rawClips, error: rawError } = await withTimeout((signal) =>
      supabase
        .from('clips_raw')
        .select('id, status, source, source_id')
        .limit(DIAG_LIMIT)
        .abortSignal(signal)
    );
    if (rawError) {
      console.error('  ❌ Error fetching raw clips:', formatQueryError(rawError));
    } else {
      const rawByStatus = rawClips?.reduce((acc: any, clip: any) => {
        acc[clip.status] = (acc[clip.status] || 0) + 1;
        return acc;
      }, {}) ?? {};
      
      console.log(`  Total: ${rawClips?.length ?? 0}`);
      console.log('  By status:', rawByStatus);
      console.log('  Sample:', rawClips?.slice(0, 3).map(c => `${c.source}/${c.source_id} (${c.status})`));
    }

    // Check segments
    console.log('\n📐 Checking segments...');
    const { data: segments, error: segError } = await withTimeout((signal) =>
      supabase
        .from('clips_segmented')
        .select('id, status, raw_clip_id, start_time, end_time')
        .limit(DIAG_LIMIT)
        .abortSignal(signal)
    );

    if (segError) {
      console.error('  ❌ Error fetching segments:', formatQueryError(segError));
    } else {
      const segByStatus = segments?.reduce((acc: any, seg: any) => {
        acc[seg.status] = (acc[seg.status] || 0) + 1;
        return acc;
      }, {}) ?? {};
      
      console.log(`  Total: ${segments?.length ?? 0}`);
      console.log('  By status:', segByStatus);
      
      // Check if segments have raw_clip references
      const segmentsWithRawClip = segments?.filter(s => s.raw_clip_id).length ?? 0;
      console.log(`  With raw_clip_id: ${segmentsWithRawClip}/${segments?.length ?? 0}`);
      
      if (segments && segments.length > 0) {
        console.log('  Sample segment:', segments[0]);
      }
    }

    // Check segments WITH relationships
    console.log('\n🔗 Checking segment→raw relationships...');
    const { data: segmentsWithRaw, error: relError } = await withTimeout((signal) =>
      supabase
        .from('clips_segmented')
        .select('id, clips_raw(id, source, source_id)')
        .limit(10)
        .abortSignal(signal)
    );

    if (relError) {
      console.error('  ❌ Error fetching relationships:', formatQueryError(relError));
    } else {
      console.log(`  Query succeeded, found ${segmentsWithRaw?.length ?? 0} segments`);
      if (segmentsWithRaw && segmentsWithRaw.length > 0) {
        const withRaw = segmentsWithRaw.filter((s: any) => s.clips_raw).length;
        console.log(`  Segments with linked raw clip: ${withRaw}/${segmentsWithRaw.length}`);
        if (withRaw === 0) {
          console.log('  ⚠️  WARNING: Segments exist but clips_raw relationship is NULL');
          console.log('  This will cause "No raw clip linked" errors during analysis');
        }
        console.log('  Sample:', segmentsWithRaw[0]);
      }
    }

    // Check analyses
    console.log('\n🧠 Checking analyses...');
    const { data: analyses, error: anaError } = await withTimeout((signal) =>
      supabase
        .from('analysis')
        .select('id, segment_id, hook, virality_score')
        .limit(DIAG_LIMIT)
        .abortSignal(signal)
    );

    if (anaError) {
      console.error('  ❌ Error fetching analyses:', formatQueryError(anaError));
    } else {
      const fakeCount = analyses?.filter(a => a.hook === 'Check this out').length ?? 0;
      const realCount = analyses?.filter(a => a.hook && a.hook !== 'Check this out').length ?? 0;
      console.log(`  Total: ${analyses?.length ?? 0}`);
      console.log(`  Real analyses: ${realCount}`);
      console.log(`  Fake analyses (to be reprocessed): ${fakeCount}`);
      
      if (realCount > 0) {
        const sample = analyses?.find(a => a.hook && a.hook !== 'Check this out');
        console.log(`  Sample real hook: "${sample?.hook}"`);
      }
    }

    // Check videos
    console.log('\n🎬 Checking videos...');
    const { data: videos, error: vidError } = await withTimeout((signal) =>
      supabase
        .from('videos_final')
        .select('id, status')
        .limit(Math.min(DIAG_LIMIT, 200))
        .abortSignal(signal)
    );

    if (vidError) {
      console.error('  ❌ Error fetching videos:', formatQueryError(vidError));
    } else {
      const vidByStatus = videos?.reduce((acc: any, vid: any) => {
        acc[vid.status] = (acc[vid.status] || 0) + 1;
        return acc;
      }, {}) ?? {};
      console.log(`  Total: ${videos?.length ?? 0}`);
      console.log('  By status:', vidByStatus);
    }

    // Summary
    console.log('\n📊 SUMMARY:\n');
    console.log(`  Raw clips: ${rawClips?.length ?? 0}`);
    console.log(`  Segments: ${segments?.length ?? 0}`);
    console.log(`  Analyses: ${analyses?.length ?? 0} (${analyses?.filter(a => a.hook && a.hook !== 'Check this out').length ?? 0} real)`);
    console.log(`  Videos: ${videos?.length ?? 0}`);

    // Diagnose the issue
    console.log('\n🔍 DIAGNOSIS:\n');
    
    if ((segments?.length ?? 0) === 0) {
      console.log('  ❌ No segments found - run segmentation first');
      console.log('     → curl -X POST https://your-app.vercel.app/api/segment');
    } else if (segmentsWithRaw?.every((s: any) => !s.clips_raw)) {
      console.log('  ❌ Segments exist but are not linked to raw clips');
      console.log('     → Check clips_segmented.raw_clip_id foreign key');
      console.log('     → Raw clips may have been deleted or IDs mismatched');
    } else {
      const unanalyzedCount = (segments?.length ?? 0) - (analyses?.filter(a => a.hook && a.hook !== 'Check this out').length ?? 0);
      console.log(`  ✅ ${unanalyzedCount} segments ready for analysis`);
      console.log('     → Run: curl "https://your-app.vercel.app/api/analyze?batchSize=20"');
    }

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }
}

diagnose();
