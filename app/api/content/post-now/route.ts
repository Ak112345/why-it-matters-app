/**
 * API endpoint to immediately generate and post content
 * POST /api/content/post-now
 */

import { NextRequest, NextResponse } from 'next/server';
import { ingestClips } from '../../../../src/ingestion/ingestClips';
import { segmentClips } from '../../../../src/ingestion/segmentClips';
import { analyzeClip } from '../../../../src/analysis/analyzeClip';
import { produceVideo } from '../../../../src/production/produceVideo';
import { queueVideos } from '../../../../src/distribution/queueVideos';
import { publishVideo } from '../../../../src/distribution/publishVideo';
import { contentCalendar } from '../../../../src/intelligence/contentCalendar';

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PipelineStage {
  stage: string;
  success: boolean;
  duration: number;
  count?: number;
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

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const stages: PipelineStage[] = [];

  try {
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      // Empty body is fine
    }

    const {
      query,
      platform,
      dryRun = false,
    } = body;

    // Use custom query or today's pillar
    const searchQuery = query || getTodaysPillar();
    const targetPlatform = platform || getTodaysPlatform();

    console.log('[POST NOW] Starting immediate content pipeline...');
    console.log(`[POST NOW] Query: "${searchQuery}", Platform: ${targetPlatform}, Dry Run: ${dryRun}`);

    // Step 1: Ingest
    let stageStart = Date.now();
    try {
      console.log('[POST NOW] 1/6: Ingesting clips...');
      const ingestResult = await ingestClips(searchQuery);
      stages.push({
        stage: 'ingest',
        success: true,
        duration: Date.now() - stageStart,
        count: ingestResult.inserted,
        data: ingestResult,
      });
      console.log(`[POST NOW] ✓ Ingested ${ingestResult.inserted} clips (${stages[0].duration}ms)`);
    } catch (error) {
      stages.push({
        stage: 'ingest',
        success: false,
        duration: Date.now() - stageStart,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }

    // Step 2: Segment
    stageStart = Date.now();
    let segmentResults;
    try {
      console.log('[POST NOW] 2/6: Segmenting clips...');
      segmentResults = await segmentClips({});
      const totalSegments = segmentResults.reduce(
        (sum, r) => sum + r.segmentCount,
        0
      );
      stages.push({
        stage: 'segment',
        success: true,
        duration: Date.now() - stageStart,
        count: totalSegments,
        data: segmentResults,
      });
      console.log(`[POST NOW] ✓ Segmented ${segmentResults.length} clips into ${totalSegments} segments (${stages[1].duration}ms)`);

      if (totalSegments === 0) {
        throw new Error('No segments created');
      }
    } catch (error) {
      stages.push({
        stage: 'segment',
        success: false,
        duration: Date.now() - stageStart,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }

    // Step 3: Analyze
    stageStart = Date.now();
    let analysisIds: string[] = [];
    try {
      console.log('[POST NOW] 3/6: Analyzing segments...');
      // Extract all segment IDs from the segment results
      const allSegmentIds = segmentResults.flatMap(r => r.segmentIds);
      analysisIds = await analyzeClip({ segmentIds: allSegmentIds, batchSize: 5 });
      stages.push({
        stage: 'analyze',
        success: true,
        duration: Date.now() - stageStart,
        count: analysisIds.length,
        data: { analysisIds },
      });
      console.log(`[POST NOW] ✓ Analyzed ${analysisIds.length} segments (${stages[2].duration}ms)`);

      if (analysisIds.length === 0) {
        throw new Error('No segments analyzed');
      }
    } catch (error) {
      stages.push({
        stage: 'analyze',
        success: false,
        duration: Date.now() - stageStart,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }

    // Step 4: Produce
    stageStart = Date.now();
    let producedVideos;
    try {
      console.log('[POST NOW] 4/6: Producing videos...');
      producedVideos = await produceVideo({
        analysisIds,
        batchSize: 1, // Just produce 1 video for immediate posting
        addSubtitles: true,
        addHookOverlay: true,
      });
      stages.push({
        stage: 'produce',
        success: true,
        duration: Date.now() - stageStart,
        count: producedVideos.length,
        data: producedVideos,
      });
      console.log(`[POST NOW] ✓ Produced ${producedVideos.length} video(s) (${stages[3].duration}ms)`);

      if (producedVideos.length === 0) {
        throw new Error('No videos produced');
      }
    } catch (error) {
      stages.push({
        stage: 'produce',
        success: false,
        duration: Date.now() - stageStart,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }

    // Step 5: Queue
    stageStart = Date.now();
    let queuedItems;
    try {
      console.log('[POST NOW] 5/6: Queueing for immediate posting...');
      queuedItems = await queueVideos({
        platform: targetPlatform,
        scheduledTime: new Date(), // Schedule for now
        batchSize: 1,
      });
      stages.push({
        stage: 'queue',
        success: true,
        duration: Date.now() - stageStart,
        count: queuedItems.length,
        data: queuedItems,
      });
      console.log(`[POST NOW] ✓ Queued ${queuedItems.length} video(s) (${stages[4].duration}ms)`);
    } catch (error) {
      stages.push({
        stage: 'queue',
        success: false,
        duration: Date.now() - stageStart,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }

    // Step 6: Publish immediately
    stageStart = Date.now();
    let publishResults;
    try {
      console.log('[POST NOW] 6/6: Publishing now...');
      publishResults = await publishVideo({
        queueId: queuedItems[0]?.queueIds?.[0],
        platform: targetPlatform as 'instagram' | 'youtube_shorts',
        dryRun,
      });
      stages.push({
        stage: 'publish',
        success: publishResults[0]?.success || false,
        duration: Date.now() - stageStart,
        count: publishResults.filter(r => r.success).length,
        data: publishResults,
      });

      if (dryRun) {
        console.log(`[POST NOW] ✓ Dry run complete - would have published (${stages[5].duration}ms)`);
      } else {
        console.log(`[POST NOW] ✓ Published ${stages[5].count} video(s) (${stages[5].duration}ms)`);
      }
    } catch (error) {
      stages.push({
        stage: 'publish',
        success: false,
        duration: Date.now() - stageStart,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }

    const totalDuration = Date.now() - startTime;
    const allSuccessful = stages.every(s => s.success);

    console.log(`[POST NOW] Pipeline complete in ${totalDuration}ms`);

    return NextResponse.json({
      success: allSuccessful,
      message: dryRun 
        ? 'Content generated (dry run - not posted)' 
        : 'Content generated and posted successfully!',
      timestamp: new Date().toISOString(),
      totalDuration,
      query: searchQuery,
      platform: targetPlatform,
      dryRun,
      stages,
      postUrl: publishResults?.[0]?.postUrl,
    });
  } catch (error) {
    const totalDuration = Date.now() - startTime;
    console.error('[POST NOW] Pipeline failed:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        totalDuration,
        stages,
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Immediate Content Generation & Posting API',
    usage: 'POST with JSON body: { query?: string, platform?: string, dryRun?: boolean }',
    description: 'Generates and posts content immediately. If query is omitted, uses today\'s content pillar.',
  });
}
