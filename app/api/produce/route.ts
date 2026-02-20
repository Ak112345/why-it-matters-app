/**
 * API endpoint to trigger video production (crop, overlay, subtitles)
 * POST /api/produce
 */

import { NextRequest, NextResponse } from 'next/server';
import { produceVideo } from '../../../src/production/produceVideo';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const {
      analysisId,
      batchSize = 5,
      addSubtitles = true,
      addHookOverlay = true,
    } = body;

    console.log(`Starting production: analysisId=${analysisId || 'batch'}`);

    const results = await produceVideo({
      analysisId,
      batchSize,
      addSubtitles,
      addHookOverlay,
    });

    return NextResponse.json({
      success: true,
      message: `Produced ${results.length} videos`,
      data: results,
    });
  } catch (error) {
    console.error('Error in produce API:', error);
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
    message: 'Video Production API',
    usage: 'POST with JSON body: { analysisId?: string, batchSize?: number, addSubtitles?: boolean, addHookOverlay?: boolean }',
  });
}
