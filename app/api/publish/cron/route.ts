/**
 * Cron endpoint for automated publishing
 * Triggered every 15 minutes by Vercel Cron
 * GET /api/publish/cron
 */

import { NextRequest, NextResponse } from 'next/server';
import { publishVideo, type PublishResult } from '../../../../src/distribution/publishVideo';

export async function GET(request: NextRequest) {
  try {
    // Verify the request is from Vercel Cron (security check)
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      console.warn('Unauthorized cron request attempt');
      // In production, you should return 401
      // For now, we'll allow it to work during development
      if (process.env.NODE_ENV === 'production' && process.env.CRON_SECRET) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }

    console.log('[CRON] Starting automated publishing check...');

    // Publish all pending posts that are due
    const results: PublishResult[] = await publishVideo({
      dryRun: false,
    });

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    const message = results.length === 0
      ? 'No pending posts due for publishing'
      : `Published ${successCount} videos, ${failCount} failed`;

    console.log(`[CRON] ${message}`);

    return NextResponse.json({
      success: true,
      message,
      timestamp: new Date().toISOString(),
      published: successCount,
      failed: failCount,
      results: results.map(r => ({
        queueId: r.queueId,
        platform: r.platform,
        success: r.success,
        error: r.error,
      })),
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
