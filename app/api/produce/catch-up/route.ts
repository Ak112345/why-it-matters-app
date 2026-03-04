export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { produceVideo } from '../../../../src/production/produceVideo';

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

  const fetchLimit = Math.max(limit * 4, 50);

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

async function runCatchUp(limit: number, batchSize: number) {
  const pendingAnalysisIds = await getPendingAnalysisIds(limit);

  if (pendingAnalysisIds.length === 0) {
    return {
      success: true,
      message: 'No pending analysis rows found',
      attempted: 0,
      produced: 0,
      failed: 0,
      analysisIds: [],
      results: [],
    };
  }

  const produceResult = await produceVideo({
    analysisIds: pendingAnalysisIds,
    batchSize,
    delayBetweenBatches: 5000,
    addSubtitles: true,
    addHookOverlay: true,
  });

  const results = Array.isArray(produceResult) ? produceResult : [produceResult];
  const produced = results.filter(r => r.success).length;

  return {
    success: produced > 0,
    message: `Catch-up run complete: ${produced}/${results.length} produced`,
    attempted: results.length,
    produced,
    failed: results.length - produced,
    analysisIds: pendingAnalysisIds,
    results,
  };
}

export async function GET(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const limit = Math.max(1, Math.min(20, Number(request.nextUrl.searchParams.get('limit') || '5')));
    const batchSize = Math.max(1, Math.min(5, Number(request.nextUrl.searchParams.get('batchSize') || '2')));

    const response = await runCatchUp(limit, batchSize);
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
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

    const limit = Math.max(1, Math.min(20, Number(body.limit ?? 5)));
    const batchSize = Math.max(1, Math.min(5, Number(body.batchSize ?? 2)));

    const response = await runCatchUp(limit, batchSize);
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
