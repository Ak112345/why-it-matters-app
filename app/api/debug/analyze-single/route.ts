import { NextRequest, NextResponse } from 'next/server';
import { analyzeClip } from '../../../../src/analysis/analyzeClip';

/**
 * Test analyzing a single segment
 * GET /api/debug/analyze-single?segmentId=...
 */
export async function GET(request: NextRequest) {
  const searchParams = new URL(request.url).searchParams;
  const segmentId = searchParams.get('segmentId');

  if (!segmentId) {
    return NextResponse.json(
      {
        success: false,
        error: 'Must provide segmentId parameter',
        example: '/api/debug/analyze-single?segmentId=1901ec6d-b2f3-4206-9aa5-54b7783dcf06',
        timestamp: new Date().toISOString(),
      },
      { status: 400 }
    );
  }

  try {
    console.log(`[analyze-single] Testing segment: ${segmentId}`);
    const result = await analyzeClip({ segmentId });

    return NextResponse.json({
      success: true,
      segmentId,
      analysisResult: result,
      message: `Successfully analyzed segment`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[analyze-single] Error analyzing ${segmentId}:`, errorMsg);

    return NextResponse.json(
      {
        success: false,
        segmentId,
        error: errorMsg,
        errorDetails: error instanceof Error ? {
          message: error.message,
          name: error.name,
          stack: error.stack?.split('\n').slice(0, 5),
        } : null,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
