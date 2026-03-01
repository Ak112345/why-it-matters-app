import { NextResponse } from 'next/server';
import { supabase } from '../../../../src/utils/supabaseClient';

/**
 * Detailed segment diagnostic endpoint
 * GET /api/debug/segments
 */
export async function GET() {
  try {
    // Get segments with their raw clip relationships
    const { data: segments, error } = await supabase
      .from('clips_segmented')
      .select(`
        id,
        status,
        raw_clip_id,
        start_time,
        end_time,
        clips_raw (
          id,
          source,
          source_id,
          status
        )
      `)
      .limit(20);

    if (error) {
      throw new Error(`Query failed: ${error.message}`);
    }

    // Check how many have raw clip links
    const withRawClip = segments?.filter(s => (s as any).clips_raw).length ?? 0;
    const withoutRawClip = segments?.filter(s => !(s as any).clips_raw).length ?? 0;

    // Check existing analyses
    const segmentIds = segments?.map(s => s.id) ?? [];
    const { data: analyses } = await supabase
      .from('analysis')
      .select('segment_id, hook')
      .in('segment_id', segmentIds);

    const analyzedCount = analyses?.filter(a => a.hook && a.hook !== 'Check this out').length ?? 0;

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary: {
        totalSegments: segments?.length ?? 0,
        withRawClip,
        withoutRawClip,
        alreadyAnalyzed: analyzedCount,
        needingAnalysis: (segments?.length ?? 0) - analyzedCount,
      },
      segments: segments?.slice(0, 5).map((s: any) => ({
        id: s.id,
        status: s.status,
        raw_clip_id: s.raw_clip_id,
        has_raw_clip_data: !!s.clips_raw,
        raw_clip: s.clips_raw ? {
          id: s.clips_raw.id,
          source: s.clips_raw.source,
          source_id: s.clips_raw.source_id,
        } : null,
        start_time: s.start_time,
        end_time: s.end_time,
      })),
      diagnosis: withoutRawClip > 0
        ? `⚠️ ${withoutRawClip} segments have no raw_clip relationship - this will cause "No raw clip linked" errors`
        : withRawClip === 0
        ? `❌ No segments have raw_clip data - check foreign key relationship`
        : `✅ Segments are properly linked to raw clips`,
    });
  } catch (error) {
    console.error('[debug/segments] Error:', error);
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
