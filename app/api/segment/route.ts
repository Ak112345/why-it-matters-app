/**
 * API endpoint to trigger video segmentation
 * POST /api/segment
 */

import { NextRequest, NextResponse } from 'next/server';
import { segmentClips } from '../../../src/ingestion/segmentClips';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const {
      rawClipId,
      segmentDuration = 10,
      minDuration = 5,
      maxDuration = 15,
    } = body;

    console.log(`Starting segmentation: rawClipId=${rawClipId || 'all'}`);

    const results = await segmentClips({
      rawClipId,
      segmentDuration,
      minDuration,
      maxDuration,
    });

    const totalSegments = results.reduce(
      (sum: number, r: { segmentCount: number }) => sum + r.segmentCount,
      0
    );

    return NextResponse.json({
      success: true,
      message: `Segmented ${results.length} clips into ${totalSegments} segments`,
      data: results,
    });
  } catch (error) {
    console.error('Error in segment API:', error);
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
    message: 'Video Segmentation API',
    usage: 'POST with JSON body: { rawClipId?: string, segmentDuration?: number, minDuration?: number, maxDuration?: number }',
  });
}
