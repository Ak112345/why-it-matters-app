/**
 * API endpoint for daily automated content generation
 * Orchestrates the full pipeline: ingest → analyze → produce → queue
 * GET /api/content/generate
 */

import { NextRequest, NextResponse } from 'next/server';
import { ingestClips } from '../../../../src/ingestion/ingestClips';
import { segmentClips } from '../../../../src/ingestion/segmentClips';
import { analyzeClip } from '../../../../src/analysis/analyzeClip';
import { produceVideo } from '../../../../src/production/produceVideo';
import { queueVideos } from '../../../../src/distribution/queueVideos';
import { contentCalendar } from '../../../../src/intelligence/contentCalendar';

interface GenerationResult {
  stage: string;
  success: boolean;
  count: number;
  data?: any;
  error?: string;
}

/**
 * Get today's content pillar from the calendar
 */
function getTodaysPillar(): string {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
  const today = days[new Date().getDay()];
  return contentCalendar[today].pillar;
}

/**
 * Get today's platform priority from the calendar
 */
function getTodaysPlatform(): 'instagram' | 'youtube_shorts' | 'all' {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
  const today = days[new Date().getDay()];
  const priority = contentCalendar[today].priority;
  
  // Normalize platform names to match queue function expectations
  if (priority === 'youtube') return 'youtube_shorts';
  if (priority === 'instagram_facebook' || priority === 'facebook' || priority === 'instagram') return 'instagram';
  return 'all';
}

export async function GET() {
  try {
    console.log('[DAILY CONTENT] Starting automated content generation...');

    const results: GenerationResult[] = [];
    const pillar = getTodaysPillar();
    const platform = getTodaysPlatform();

    console.log(`[DAILY CONTENT] Today's focus: ${pillar} (Platform: ${platform})`);

    // Step 1: Ingest clips based on today's content pillar
    try {
      console.log(`[DAILY CONTENT] Step 1: Ingesting clips for "${pillar}"...`);
      const ingestResult = await ingestClips(pillar);
      
      results.push({
        stage: 'ingest',
        success: true,
        count: ingestResult.inserted,
        data: ingestResult,
      });

      console.log(`[DAILY CONTENT] ✓ Ingested ${ingestResult.inserted} clips`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('[DAILY CONTENT] ✗ Ingestion failed:', errorMsg);
      results.push({
        stage: 'ingest',
        success: false,
        count: 0,
        error: errorMsg,
      });
      throw error; // Stop pipeline if ingestion fails
    }

    // Step 2: Analyze clips
    let segmentResults;
    try {
      console.log('[DAILY CONTENT] Step 2: Segmenting clips...');
      segmentResults = await segmentClips({});
      const totalSegments = segmentResults.reduce(
        (sum, r) => sum + r.segmentCount,
        0
      );
      
      results.push({
        stage: 'segment',
        success: true,
        count: totalSegments,
        data: segmentResults,
      });

      console.log(`[DAILY CONTENT] ✓ Segmented ${segmentResults.length} clips into ${totalSegments} segments`);

      if (totalSegments === 0) {
        throw new Error('No segments were created');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('[DAILY CONTENT] ✗ Segmentation failed:', errorMsg);
      results.push({
        stage: 'segment',
        success: false,
        count: 0,
        error: errorMsg,
      });
      throw error;
    }

    // Step 3: Analyze segments
    let analysisIds: string[] = [];
    try {
      console.log('[DAILY CONTENT] Step 3: Analyzing segments...');
      // Extract all segment IDs from the segment results
      const allSegmentIds = segmentResults.flatMap(r => r.segmentIds);
      analysisIds = await analyzeClip({ segmentIds: allSegmentIds, batchSize: 12 });
      
      results.push({
        stage: 'analyze',
        success: true,
        count: analysisIds.length,
        data: { analysisIds },
      });

      console.log(`[DAILY CONTENT] ✓ Analyzed ${analysisIds.length} clips`);

      if (analysisIds.length === 0) {
        throw new Error('No segments were analyzed');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('[DAILY CONTENT] ✗ Analysis failed:', errorMsg);
      results.push({
        stage: 'analyze',
        success: false,
        count: 0,
        error: errorMsg,
      });
      throw error; // Stop pipeline if analysis fails
    }

    // Step 4: Produce videos
    try {
      console.log('[DAILY CONTENT] Step 4: Producing videos...');
      const videos = await produceVideo({
        analysisIds,
        batchSize: 4, // Produce 4 videos daily (2 per platform for 2x daily)
        addSubtitles: true,
        addHookOverlay: true,
      });
      
      results.push({
        stage: 'produce',
        success: true,
        count: videos.length,
        data: videos,
      });

      console.log(`[DAILY CONTENT] ✓ Produced ${videos.length} videos`);

      if (videos.length === 0) {
        throw new Error('No videos were produced');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('[DAILY CONTENT] ✗ Production failed:', errorMsg);
      results.push({
        stage: 'produce',
        success: false,
        count: 0,
        error: errorMsg,
      });
      throw error; // Stop pipeline if production fails
    }

    // Step 5: Queue videos for posting
    try {
      console.log('[DAILY CONTENT] Step 5: Queueing videos for posting...');
      const queued = await queueVideos({
        platform: platform as 'instagram' | 'youtube_shorts' | 'all',
        batchSize: 4,
      });
      
      results.push({
        stage: 'queue',
        success: true,
        count: queued.length,
        data: queued,
      });

      console.log(`[DAILY CONTENT] ✓ Queued ${queued.length} videos`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('[DAILY CONTENT] ✗ Queueing failed:', errorMsg);
      results.push({
        stage: 'queue',
        success: false,
        count: 0,
        error: errorMsg,
      });
      // Don't throw here - videos are produced, we can queue later
    }

    const totalSuccess = results.filter(r => r.success).length;
    const totalStages = results.length;

    console.log(`[DAILY CONTENT] Content generation complete: ${totalSuccess}/${totalStages} stages successful`);

    return NextResponse.json({
      success: totalSuccess === totalStages,
      message: `Daily content generated: ${pillar}`,
      timestamp: new Date().toISOString(),
      pillar,
      platform,
      results,
    });
  } catch (error) {
    console.error('[DAILY CONTENT] Error in content generation:', error);
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

export async function POST(request: NextRequest) {
  // Allow POST for manual triggers
  return GET();
}
