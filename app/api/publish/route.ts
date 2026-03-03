/**
 * API endpoint to publish videos (called by Quiet Hours or cron)
 * POST /api/publish
 */

import { NextRequest, NextResponse } from 'next/server';
import { publishVideo, retryFailedPosts, type PublishResult } from '../../../src/distribution/publishVideo';

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
    
    // Support both JSON body and empty body (for manual triggers)
    try {
      body = await request.json();
    } catch {
      // Empty body is fine, use defaults
    }
    
    const {
      queueId,
      platform,
      dryRun = false,
      retryFailed = false,
    } = body;

    console.log(`Starting publishing: queueId=${queueId || 'due posts'}, platform=${platform || 'all'}`);

    let results: PublishResult[];

    if (retryFailed) {
      results = await retryFailedPosts();
    } else {
      results = await publishVideo({
        queueId,
        platform,
        dryRun,
      });
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    return NextResponse.json({
      success: true,
      message: `Published ${successCount} videos, ${failCount} failed`,
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
    message: 'Video Publishing API',
    usage: 'POST with JSON body: { queueId?: string, platform?: string, dryRun?: boolean, retryFailed?: boolean }',
  });
}
