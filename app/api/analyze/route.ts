/**
 * API endpoint to trigger clip analysis with OpenAI
 * POST /api/analyze
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

    console.log(`Starting analysis: segmentId=${segmentId || 'batch'}, batchSize=${batchSize}`);

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
    });
  } catch (error) {
    console.error('Error in analyze API:', error);
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
    message: 'Clip Analysis API',
    usage: 'POST with JSON body: { segmentId?: string, batchSize?: number }',
  });
}
