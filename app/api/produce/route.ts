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

    // Get failed/error count from videos_final for this batch
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.SUPABASE_SERVICE_ROLE_KEY || ""
    );
    
    const { data: errorRows } = await supabase
      .from('videos_final')
      .select('status')
      .eq('status', 'error')
      .gte('created_at', new Date(Date.now() - 300000).toISOString()); // last 5 min

    return NextResponse.json({
      success: true,
      message: `Produced ${results.length} videos (${errorRows?.length || 0} failed in last 5min)`,
      data: results,
      stats: {
        produced: results.length,
        recentFailures: errorRows?.length || 0,
      },
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
