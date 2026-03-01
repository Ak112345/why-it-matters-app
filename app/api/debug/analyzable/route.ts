import { NextResponse } from 'next/server';
import { supabase } from '../../../../src/utils/supabaseClient';

/**
 * Find analyzable segments endpoint
 * GET /api/debug/analyzable
 */
export async function GET() {
  try {
    // Get first 30 segments
    const { data: allSegments } = await supabase
      .from('clips_segmented')
      .select('id')
      .limit(30);

    if (!allSegments || allSegments.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No segments found',
        timestamp: new Date().toISOString(),
      });
    }

    // Get existing analyses for these segments
    const { data: analyzed } = await supabase
      .from('analysis')
      .select('segment_id, hook')
      .in('segment_id', allSegments.map((s: any) => s.id));

    // Filter out segments with real analysis
    const reallyAnalyzedIds = new Set(
      (analyzed || [])
        .filter((a: any) => a.hook && a.hook !== 'Check this out')
        .map((a: any) => a.segment_id)
    );

    const needingAnalysis = allSegments.filter((s: any) => !reallyAnalyzedIds.has(s.id));

    // For segments that need analysis, fetch their metadata and raw clips separately
    const sampleIds = needingAnalysis.slice(0, 5).map((s: any) => s.id);
    const { data: samples } = await supabase
      .from('clips_segmented')
      .select('id, raw_clip_id')
      .in('id', sampleIds);

    const rawClipIds = (samples || [])
      .map((s: any) => s.raw_clip_id)
      .filter(Boolean);

    const rawClipsMap = new Map();
    if (rawClipIds.length > 0) {
      const { data: rawClips } = await supabase
        .from('clips_raw')
        .select('id, source, source_id')
        .in('id', rawClipIds);

      (rawClips || []).forEach((rc: any) => {
        rawClipsMap.set(rc.id, rc);
      });
    }

    const samplesWithRaw = (samples || []).map((s: any) => ({
      ...s,
      clips_raw: s.raw_clip_id ? rawClipsMap.get(s.raw_clip_id) : null,
    }));

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary: {
        totalChecked: allSegments.length,
        alreadyAnalyzed: allSegments.length - needingAnalysis.length,
        needingAnalysis: needingAnalysis.length,
      },
      sampleSegmentsNeedingAnalysis: samplesWithRaw.map((s: any) => ({
        id: s.id,
        raw_clip_id: s.raw_clip_id,
        has_raw_data: !!s.clips_raw,
        raw_source: s.clips_raw?.source,
        raw_source_id: s.clips_raw?.source_id,
      })),
      diagnosis:
        samplesWithRaw && samplesWithRaw.every((s: any) => !s.clips_raw)
          ? '❌ Segments have NO raw_clip data - foreign key broken'
          : samplesWithRaw && samplesWithRaw.some((s: any) => !s.clips_raw)
          ? `⚠️ Some segments missing raw_clip data`
          : '✅ Segments have proper raw_clip links',
    });
  } catch (error) {
    console.error('[debug/analyzable] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
