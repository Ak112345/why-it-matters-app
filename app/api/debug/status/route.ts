import { NextResponse } from 'next/server';
import { supabase } from '../../../../src/utils/supabaseClient';

/**
 * Debug endpoint to check pipeline status
 * GET /api/debug/status
 */
export async function GET() {
  try {
    // Check raw clips
    const { data: rawClips, error: rawError } = await supabase
      .from('clips_raw')
      .select('id, status')
      .limit(1000);
    
    const rawByStatus = rawClips?.reduce((acc: any, clip: any) => {
      acc[clip.status] = (acc[clip.status] || 0) + 1;
      return acc;
    }, {}) ?? {};

    // Check segments
    const { data: segments, error: segError } = await supabase
      .from('clips_segmented')
      .select('id, status')
      .limit(1000);
    
    const segmentsByStatus = segments?.reduce((acc: any, seg: any) => {
      acc[seg.status] = (acc[seg.status] || 0) + 1;
      return acc;
    }, {}) ?? {};

    // Check analyses
    const { data: allAnalyses } = await supabase
      .from('analysis')
      .select('id, hook')
      .limit(1000);
    
    const fakeCount = (allAnalyses || []).filter(a => a.hook === 'Check this out').length;
    const realCount = (allAnalyses || []).filter(a => a.hook && a.hook !== 'Check this out').length;

    // Check videos produced
    const { data: videos } = await supabase
      .from('videos_final')
      .select('id, status')
      .limit(1000);
    
    const videosByStatus = videos?.reduce((acc: any, vid: any) => {
      acc[vid.status] = (acc[vid.status] || 0) + 1;
      return acc;
    }, {}) ?? {};

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      database: {
        rawClips: {
          total: rawClips?.length ?? 0,
          byStatus: rawByStatus,
          error: rawError?.message,
        },
        segments: {
          total: segments?.length ?? 0,
          byStatus: segmentsByStatus,
          error: segError?.message,
        },
        analyses: {
          total: (allAnalyses?.length ?? 0),
          real: realCount,
          fake: fakeCount,
        },
        videos: {
          total: videos?.length ?? 0,
          byStatus: videosByStatus,
        },
      },
      instructions: {
        nextStep: realCount === 0 
          ? 'No real analyses yet. Run /api/content/generate or queue /api/analyze?batchSize=20'
          : `${realCount} analyses ready. Run /api/content/generate to produce videos.`,
      },
    });
  } catch (error) {
    console.error('[status] Error:', error);
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
