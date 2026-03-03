export const maxDuration = 300;
export const dynamic = 'force-dynamic';

/**
 * Bulk finalize endpoint: processes existing analyzed clips through production
 * and queues them for all platforms (TikTok queued for manual scheduling).
 *
 * GET /api/content/bulk-finalize?batchSize=20&dryRun=false
 *
 * This handles the backlog of 900+ clips by:
 *   1. Finding analyses not yet produced
 *   2. Dispatching each to the Railway worker
 *   3. Queuing produced videos for Instagram, YouTube, Facebook (auto), and TikTok (manual)
 */

import { NextRequest, NextResponse } from 'next/server';
import { produceVideoBatch } from '../../../../src/production/produceVideo';
import { queueVideos } from '../../../../src/distribution/queueVideos';
import { supabase } from '../../../../src/utils/supabaseClient';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const batchSize = Math.min(parseInt(searchParams.get('batchSize') || '20'), 100);
  const dryRun = searchParams.get('dryRun') === 'true';

  try {
    console.log(`[bulk-finalize] Starting bulk finalize (batchSize=${batchSize}, dryRun=${dryRun})`);

    // Count backlog
    const { count: pendingCount } = await supabase
      .from('analysis')
      .select('id', { count: 'exact', head: true });

    const { count: producedCount } = await supabase
      .from('videos_final')
      .select('id', { count: 'exact', head: true });

    const { count: queuedCount } = await supabase
      .from('posting_queue')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending');

    const backlog = {
      totalAnalyses: pendingCount ?? 0,
      producedVideos: producedCount ?? 0,
      pendingInQueue: queuedCount ?? 0,
    };

    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        message: `Dry run: would process up to ${batchSize} clips`,
        backlog,
        timestamp: new Date().toISOString(),
      });
    }

    // Step 1: Produce videos from unprocessed analyses
    console.log(`[bulk-finalize] Step 1: Producing up to ${batchSize} videos...`);
    const produceResults = await produceVideoBatch({ batchSize });
    const producedSuccessfully = produceResults.filter(r => r.success);
    console.log(`[bulk-finalize] Produced ${producedSuccessfully.length}/${produceResults.length} videos`);

    // Step 2: Queue all unqueued produced videos for all platforms
    console.log('[bulk-finalize] Step 2: Queueing produced videos for all platforms...');
    const queueResults = await queueVideos({ platform: 'all', batchSize });
    console.log(`[bulk-finalize] Queued ${queueResults.length} videos`);

    return NextResponse.json({
      success: true,
      message: `Bulk finalize complete: ${producedSuccessfully.length} produced, ${queueResults.length} queued`,
      timestamp: new Date().toISOString(),
      backlog,
      produced: {
        attempted: produceResults.length,
        succeeded: producedSuccessfully.length,
        failed: produceResults.filter(r => !r.success).length,
        errors: produceResults.filter(r => !r.success).map(r => r.error).slice(0, 5),
      },
      queued: {
        count: queueResults.length,
        platforms: ['instagram', 'youtube_shorts', 'facebook', 'tiktok'],
        note: 'TikTok entries are queued for manual batch scheduling via /api/tiktok/ready',
      },
    });
  } catch (error: any) {
    console.error('[bulk-finalize] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
