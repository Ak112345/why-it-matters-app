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
import { contentCalendar } from '../../../../src/intelligence/contentCalendar';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

function mapPlatformToEndpoint(platform?: string): string | null {
  if (!platform) return null;
  if (platform === 'youtube' || platform === 'youtube_shorts') return '/youtube/post';
  if (platform === 'instagram' || platform === 'facebook') return '/meta/post';
  return null;
}

function normalizeStoragePath(filePath?: string | null): string | null {
  if (!filePath) return null;
  const decoded = decodeURIComponent(filePath);
  const marker = '/storage/v1/object/public/final_videos/';
  const index = decoded.indexOf(marker);
  if (index >= 0) return decoded.substring(index + marker.length).split('?')[0];
  if (decoded.startsWith('final_videos/')) return decoded.substring('final_videos/'.length).split('?')[0];
  return null;
}

async function fetchPostingJobById(jobId: string): Promise<any> {
  const { data, error } = await supabase
    .from('posting_queue')
    .select(`
      id,
      platform,
      status,
      final_video_id,
      scheduled_for,
      videos_final (id, final_video_path, file_path)
    `)
    .eq('id', jobId)
    .single();

  if (error || !data) throw new Error(`Job not found: ${jobId}`);
  return data;
}

async function assertFinalVideoExists(job: any): Promise<{ ok: boolean; finalVideoPath?: string; error?: string }> {
  const nested = job?.videos_final;
  const video = Array.isArray(nested) ? nested[0] : nested;
  const finalVideoPath = video?.final_video_path || normalizeStoragePath(video?.file_path);
  if (!finalVideoPath) return { ok: false, error: 'Missing final_video_path/file_path on job' };

  const { data, error } = await supabase.storage.from('final_videos').download(finalVideoPath);
  if (error || !data) return { ok: false, finalVideoPath, error: `Final video missing: ${error?.message || 'not found'}` };

  return { ok: true, finalVideoPath };
}

async function triggerRailwayPost(jobId: string, platform?: string): Promise<any> {
  const endpoint = mapPlatformToEndpoint(platform);
  if (!endpoint) {
    return { jobId, platform: platform || 'unknown', success: false, error: `Unsupported platform for worker posting: ${platform || 'unknown'}` };
  }

  const workerBaseUrl = process.env.RAILWAY_WORKER_URL;
  const workerSecret = process.env.WORKER_SECRET;
  if (!workerBaseUrl) return { jobId, platform: platform || 'unknown', endpoint, success: false, error: 'Missing RAILWAY_WORKER_URL' };
  if (!workerSecret) return { jobId, platform: platform || 'unknown', endpoint, success: false, error: 'Missing WORKER_SECRET' };

  const response = await fetch(`${workerBaseUrl}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-worker-secret': workerSecret },
    body: JSON.stringify({ jobId }),
  });

  const text = await response.text();
  let body: any = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text }; }

  if (!response.ok) {
    return { jobId, platform: platform || 'unknown', endpoint, success: false, response: body, error: body?.error || `Worker request failed with ${response.status}` };
  }

  return { jobId, platform: platform || 'unknown', endpoint, success: true, response: body };
}

async function triggerRailwayPostForQueueJob(jobId: string): Promise<any> {
  const job = await fetchPostingJobById(jobId);
  const exists = await assertFinalVideoExists(job);
  if (!exists.ok) {
    return { jobId, platform: job.platform || 'unknown', success: false, error: exists.error };
  }
  return triggerRailwayPost(jobId, job.platform);
}

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
 * NOTE: Returning youtube_shorts only for now while we stabilize YouTube posting
 */
function getTodaysPlatform(): 'instagram' | 'youtube_shorts' | 'all' {
  // Temporarily return youtube_shorts only to focus on YouTube stability
  // TODO: Re-enable multiple platforms after YouTube posting is stable
  return 'youtube_shorts';
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

    // Step 6: Trigger Railway posting immediately
    stageStart = Date.now();
    let publishResults: any[] = [];
    try {
      console.log('[POST NOW] 6/6: Triggering Railway posting...');

      const queueIds = queuedItems.flatMap(item => item.queueIds || []);

      for (const queueId of queueIds) {
        if (dryRun) {
          publishResults.push({ queueId, success: true, dryRun: true });
          continue;
        }

        const trigger = await triggerRailwayPostForQueueJob(queueId);
        publishResults.push(trigger);
      }

      stages.push({
        stage: 'publish',
        success: publishResults.every(r => r.success),
        duration: Date.now() - stageStart,
        count: publishResults.filter(r => r.success).length,
        data: publishResults,
      });

      if (dryRun) {
        console.log(`[POST NOW] ✓ Dry run complete - trigger skipped (${stages[5].duration}ms)`);
      } else {
        console.log(`[POST NOW] ✓ Triggered ${stages[5].count} posting job(s) (${stages[5].duration}ms)`);
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
        : 'Content generated and posting triggered successfully!',
      timestamp: new Date().toISOString(),
      totalDuration,
      query: searchQuery,
      platform: targetPlatform,
      dryRun,
      stages,
      triggerResults: publishResults,
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
    message: 'Immediate Content Generation & Posting API (YouTube focused)',
    usage: 'POST with JSON body: { query?: string, platform?: string, dryRun?: boolean }',
    description: 'Generates and posts content immediately to YouTube only (Meta paused for stability). If query is omitted, uses today\'s content pillar.',
    note: 'Using YouTube (youtube_shorts) platform only for now. Use /api/publish to manually trigger other platforms.',
  });
}
