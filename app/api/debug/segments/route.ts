import { NextResponse } from 'next/server';
import { supabase } from '../../../../src/utils/supabaseClient';

/**
 * Detailed segment diagnostic endpoint
 * GET /api/debug/segments
 */
export async function GET() {
  try {
    // Get segments - no relationship join
    const { data: segments, error } = await supabase
      .from('clips_segmented')
      .select('id, status, raw_clip_id, start_time, end_time')
      .limit(20);

    if (error) {
      throw new Error(`Query failed: ${error.message}`);
    }

    // Fetch raw clips separately for segments that have raw_clip_id
    const rawClipIds = (segments || [])
      .map((s: any) => s.raw_clip_id)
      .filter(Boolean);

    const rawClipsMap = new Map();
    if (rawClipIds.length > 0) {
      const { data: rawClips } = await supabase
        .from('clips_raw')
        .select('id, source, source_id, status')
        .in('id', rawClipIds);

      (rawClips || []).forEach((rc: any) => {
        rawClipsMap.set(rc.id, rc);
      });
    }

    const enrichedSegments = (segments || []).map((s: any) => ({
      ...s,
      clips_raw: s.raw_clip_id ? rawClipsMap.get(s.raw_clip_id) : null,
    }));

    // Check how many have raw clip links
    const withRawClip = enrichedSegments.filter(s => s.clips_raw).length;
    const withoutRawClip = enrichedSegments.filter(s => !s.clips_raw).length;

    // Check existing analyses
    const segmentIds = enrichedSegments.map(s => s.id);
    const { data: analyses } = await supabase
      .from('analysis')
      .select('segment_id, hook')
      .in('segment_id', segmentIds);

    const analyzedCount = analyses?.filter(a => a.hook && a.hook !== 'Check this out').length ?? 0;

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary: {
        totalSegments: enrichedSegments.length,
        withRawClip,
        withoutRawClip,
        alreadyAnalyzed: analyzedCount,
        needingAnalysis: enrichedSegments.length - analyzedCount,
      },
      segments: enrichedSegments.slice(0, 5).map((s: any) => ({
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
