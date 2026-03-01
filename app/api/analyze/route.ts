/**
 * API endpoint to trigger clip analysis with OpenAI
 * POST /api/analyze or GET /api/analyze?batchSize=20
 */

import { NextRequest, NextResponse } from 'next/server';
import { analyzeClip } from '../../../src/analysis/analyzeClip';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const {
      segmentId,
      batchSize = 10,
    } = body;

    console.log(`[POST /api/analyze] Starting analysis: segmentId=${segmentId || 'batch'}, batchSize=${batchSize}`);

    const analysisIds = await analyzeClip({
      segmentId,
      batchSize,
    });

    return NextResponse.json({
      success: true,
      message: `Analyzed ${analysisIds.length} segments`,
      data: {
        analysisIds,
        count: analysisIds.length,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[POST /api/analyze] Error:', errorMsg);
    return NextResponse.json(
      {
        success: false,
        error: errorMsg,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = new URL(request.url).searchParams;
    const batchSize = parseInt(searchParams.get('batchSize') || '20', 10);

    console.log(`[GET /api/analyze] Starting batch analysis with batchSize=${batchSize}`);

    const analysisIds = await analyzeClip({ batchSize });

    return NextResponse.json({
      success: true,
      message: `Analyzed ${analysisIds.length} segments`,
      data: {
        analysisIds,
        count: analysisIds.length,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[GET /api/analyze] Error:', errorMsg);
    return NextResponse.json(
      {
        success: false,
        error: errorMsg,
        usage: 'GET /api/analyze?batchSize=20 or POST with { batchSize: 20 }',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
