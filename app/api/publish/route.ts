/**
 * API endpoint to trigger Railway posting jobs
 * POST /api/publish
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  assertFinalVideoExists,
  fetchDuePostingJobs,
  fetchPostingJobById,
  triggerRailwayPost,
} from '../../../src/distribution/railwayPosting';

function isAuthorized(request: NextRequest): boolean {
  if (process.env.NODE_ENV !== 'production') return true;

  const authHeader = request.headers.get('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const cronSecret = process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET || '';

  return !!cronSecret && bearerToken === cronSecret;
}

export async function POST(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const { queueId, platform } = body;
    const platformFilter = platform || 'youtube'; // Default to YouTube only for now

    const jobs = queueId
      ? [await fetchPostingJobById(queueId)]
      : await fetchDuePostingJobs(5, platformFilter);

    if (!jobs.length) {
      return NextResponse.json({
        success: true,
        message: `No ${platformFilter} posting jobs due`,
        data: [],
      });
    }

    const results = [] as any[];

    for (const job of jobs) {
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

      const triggered = await triggerRailwayPost(job.id, job.platform);
      results.push(triggered);
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.length - successCount;

    return NextResponse.json({
      success: failCount === 0,
      message: `Triggered ${successCount} ${platformFilter} jobs, ${failCount} failed`,
      data: results,
    });
  } catch (error) {
    console.error('Error in publish API:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Publish trigger API',
    usage: 'POST with optional body: { queueId?: string, platform?: string }',
    note: 'Defaults to YouTube only (instagram/facebook/youtube_shorts can be requested via platform param)',
    examples: {
      youtubeOnly: { platform: 'youtube' },
      instagram: { platform: 'instagram' },
      facebook: { platform: 'facebook' },
      specificJob: { queueId: 'job-id-here' },
    },
  });
}
