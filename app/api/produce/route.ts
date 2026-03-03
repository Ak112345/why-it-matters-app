/**
 * API endpoint to trigger video production (crop, overlay, subtitles)
 * POST /api/produce
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { produceVideo } from '../../../src/production/produceVideo';

function isAuthorized(request: NextRequest): boolean {
  if (process.env.NODE_ENV !== 'production') return true;

  const authHeader = request.headers.get('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const cronSecret = process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET || '';

  return !!cronSecret && bearerToken === cronSecret;
}

async function getPendingAnalysisIds(limit: number): Promise<string[]> {
  const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );

  const fetchLimit = Math.max(limit * 3, 20);

  const { data: analyses, error: analysisError } = await supabase
    .from('analysis')
    .select('id')
    .order('created_at', { ascending: true })
    .limit(fetchLimit);

  if (analysisError || !analyses?.length) {
    return [];
  }

  const candidateIds = analyses.map(a => a.id);

  const { data: existingVideos } = await supabase
    .from('videos_final')
    .select('analysis_id')
    .in('analysis_id', candidateIds);

  const existingSet = new Set((existingVideos || []).map(v => v.analysis_id));
  return candidateIds.filter(id => !existingSet.has(id)).slice(0, limit);
}

async function runProduction(input: {
  analysisId?: string;
  analysisIds?: string[];
  batchSize?: number;
  addSubtitles?: boolean;
  addHookOverlay?: boolean;
}) {
  const {
    analysisId,
    analysisIds,
    batchSize = 2,
    addSubtitles = true,
    addHookOverlay = true,
  } = input;

  const explicitIds = Array.isArray(analysisIds)
    ? analysisIds.filter(Boolean)
    : analysisId
      ? [analysisId]
      : [];

  const targetAnalysisIds = explicitIds.length > 0
    ? explicitIds
    : await getPendingAnalysisIds(batchSize);

  if (targetAnalysisIds.length === 0) {
    return {
      success: true,
      message: 'No pending analysis rows to produce',
      data: [],
      stats: {
        produced: 0,
        attempted: 0,
        recentFailures: 0,
      },
    };
  }

  console.log(`Starting production: ${targetAnalysisIds.length} analysis row(s)`);

  const produceResult = await produceVideo({
    analysisIds: targetAnalysisIds,
    batchSize,
    delayBetweenBatches: 5000,
    addSubtitles,
    addHookOverlay,
  });

  const results = Array.isArray(produceResult) ? produceResult : [produceResult];
  const producedCount = results.filter(r => r.success).length;

  const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );

  const { data: errorRows } = await supabase
    .from('videos_final')
    .select('status')
    .eq('status', 'error')
    .gte('created_at', new Date(Date.now() - 300000).toISOString());

  return {
    success: true,
    message: `Produced ${producedCount}/${results.length} videos (${errorRows?.length || 0} failed in last 5min)`,
    data: results,
    stats: {
      produced: producedCount,
      attempted: results.length,
      recentFailures: errorRows?.length || 0,
    },
  };
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

    const response = await runProduction(body);
    return NextResponse.json(response);
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

export async function GET(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const batchSize = Number(request.nextUrl.searchParams.get('batchSize') || '2');
    const response = await runProduction({ batchSize });
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
