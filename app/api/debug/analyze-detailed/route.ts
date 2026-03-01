import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../src/utils/supabaseClient';

/**
 * Full diagnostic analysis endpoint  
 * GET /api/debug/analyze-detailed
 */
export async function GET(request: NextRequest) {
  const searchParams = new URL(request.url).searchParams;
  const batchSize = parseInt(searchParams.get('batchSize') || '5', 10);
  const diagnostics: any = { logs: [] };

  try {
    diagnostics.logs.push('Starting batch analysis...');
    
    // Step 1: Fetch segments
    diagnostics.logs.push(`Fetching ${batchSize * 3} segments...`);
    const { data: allSegments, error: fetchError } = await supabase
      .from('clips_segmented')
      .select('id, status')
      .order('created_at', { ascending: true })
      .limit(batchSize * 3);

    if (fetchError) {
      diagnostics.logs.push(`ERROR fetching segments: ${fetchError.message}`);
      throw fetchError;
    }

    const segmentCount = allSegments?.length ?? 0;
    diagnostics.logs.push(`✓ Found ${segmentCount} segments`);
    diagnostics.allSegmentIds = allSegments?.map((s: any) => s.id) ?? [];

    // Step 2: Fetch existing analyses
    const searchIds = allSegments?.map((s: any) => s.id) ?? [];
    if (searchIds.length === 0) {
      diagnostics.logs.push('No segments to check');
      return NextResponse.json({ success: false, diagnostics });
    }

    diagnostics.logs.push(`Checking analyses for ${searchIds.length} segments...`);
    const { data: analyzed, error: analysisError } = await supabase
      .from('analysis')
      .select('segment_id, hook')
      .in('segment_id', searchIds);

    if (analysisError) {
      diagnostics.logs.push(`ERROR fetching analyses: ${analysisError.message}`);
    }

    diagnostics.logs.push(`✓ Found ${analyzed?.length ?? 0} analyses`);
    diagnostics.analyses = (analyzed || []).map((a: any) => ({
      segment_id: a.segment_id,
      hook: a.hook?.substring(0, 40),
      isReal: a.hook && a.hook !== 'Check this out',
    }));

    // Step 3: Filter for real analyses
    const reallyAnalyzedIds = new Set(
      (analyzed || [])
        .filter((a: any) => a.hook && a.hook !== 'Check this out')
        .map((a: any) => a.segment_id)
    );

    diagnostics.logs.push(`✓ ${reallyAnalyzedIds.size} segments have real analyses`);
    diagnostics.realAnalyzedIds = Array.from(reallyAnalyzedIds);

    // Step 4: Find segments needing analysis
    const segments = allSegments
      ?.filter((s: any) => !reallyAnalyzedIds.has(s.id))
      .slice(0, batchSize) ?? [];

    diagnostics.logs.push(`✓ ${segments.length} segments need analysis (filtered from ${segmentCount})`);
    diagnostics.segmentsNeedingAnalysis = segments.map((s: any) => s.id);

    // Return the diagnostic info
    return NextResponse.json({
      success: true,
      batchSize,
      diagnostics,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    diagnostics.logs.push(`ERROR: ${error instanceof Error ? error.message : String(error)}`);
    return NextResponse.json(
      {
        success: false,
        diagnostics,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
