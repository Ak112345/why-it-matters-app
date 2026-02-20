/**
 * API endpoint to queue videos for posting
 * POST /api/queue
 */

import { NextRequest, NextResponse } from 'next/server';
import { queueVideos, getUpcomingPosts } from '../../../src/distribution/queueVideos';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const {
      videoId,
      platform = 'all',
      scheduledTime,
      batchSize = 10,
    } = body;

    console.log(`Starting queueing: videoId=${videoId || 'batch'}, platform=${platform}`);

    const results = await queueVideos({
      videoId,
      platform,
      scheduledTime: scheduledTime ? new Date(scheduledTime) : undefined,
      batchSize,
    });

    return NextResponse.json({
      success: true,
      message: `Queued ${results.length} videos`,
      data: results,
    });
  } catch (error) {
    console.error('Error in queue API:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');

    const upcomingPosts = await getUpcomingPosts(limit);

    return NextResponse.json({
      success: true,
      data: upcomingPosts,
      count: upcomingPosts.length,
    });
  } catch (error) {
    console.error('Error in queue API:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
