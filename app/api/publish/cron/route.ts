export const dynamic = 'force-dynamic';
/**
 * Cron endpoint for automated posting trigger (YouTube only for now)
 * GET /api/publish/cron
 */

import { NextResponse } from 'next/server';
import { assertFinalVideoExists, fetchDuePostingJobs, triggerRailwayPost } from '../../../../src/distribution/railwayPosting';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const jobs = await fetchDuePostingJobs(10);

    // Filter for YouTube only (pause Meta for now)
    const youtubeJobs = jobs.filter(job => 
      job.platform === 'youtube' || job.platform === 'youtube_shorts'
    );

    if (!youtubeJobs.length) {
      return NextResponse.json({
        success: true,
        message: 'No YouTube posts due for publishing (Meta/Instagram/Facebook paused)',
        timestamp: new Date().toISOString(),
        triggered: 0,
        failed: 0,
        results: [],
        skipped: jobs.length,
      });
    }

    const results = [] as any[];

    for (const job of youtubeJobs) {
      const exists = await assertFinalVideoExists(job);
      if (!exists.ok) {
        results.push({
          jobId: job.id,
          platform: job.platform,
          success: false,
          error: exists.error,
        });
        continue;
      }

      const triggerResult = await triggerRailwayPost(job.id, job.platform);
      results.push(triggerResult);
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.length - successCount;

    return NextResponse.json({
      success: failCount === 0,
      message: `Triggered ${successCount} YouTube jobs, ${failCount} failed (Meta paused)`,
      timestamp: new Date().toISOString(),
      triggered: successCount,
      failed: failCount,
      skipped: jobs.length - youtubeJobs.length,
      results,
    });
  } catch (error) {
    console.error('[CRON] Error in automated publishing:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
