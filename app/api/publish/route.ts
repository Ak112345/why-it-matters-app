/**
 * API endpoint to trigger Railway posting jobs
 * POST /api/publish
 */

import { NextRequest, NextResponse } from 'next/server';
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

async function fetchDuePostingJobs(limit: number = 5, platformFilter?: string): Promise<any[]> {
  const now = new Date().toISOString();
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
    .in('status', ['pending', 'queued', 'rendered'])
    .lte('scheduled_for', now)
    .order('scheduled_for', { ascending: true })
    .limit(limit);

  if (error) throw new Error(`Failed to fetch due posting jobs: ${error.message}`);

  let jobs = data || [];
  if (platformFilter) {
    jobs = jobs.filter(job => {
      if (platformFilter === 'youtube') return job.platform === 'youtube' || job.platform === 'youtube_shorts';
      return job.platform === platformFilter;
    });
  }
  return jobs;
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

function isAuthorized(request: NextRequest): boolean {
  if (process.env.NODE_ENV !== 'production') return true;

  const authHeader = request.headers.get('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const cronSecret = process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET || '';

  return !!cronSecret && bearerToken === cronSecret;
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

    const { queueId, platform } = body;
    const platformFilter = platform || 'youtube'; // Default to YouTube only for now

    const jobs = queueId
      ? [await fetchPostingJobById(queueId)]
      : await fetchDuePostingJobs(5, platformFilter);

    if (!jobs.length) {
      return NextResponse.json({
        success: true,
        message: `No ${platformFilter} posting jobs due`,
        data: [],
      });
    }

    const results = [] as any[];

    for (const job of jobs) {
      const exists = await assertFinalVideoExists(job);
      if (!exists.ok) {
        results.push({
          jobId: job.id,
          platform: job.platform,
          success: false,
          error: exists.error,
        });
        continue;
      }

      const triggered = await triggerRailwayPost(job.id, job.platform);
      results.push(triggered);
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.length - successCount;

    return NextResponse.json({
      success: failCount === 0,
      message: `Triggered ${successCount} ${platformFilter} jobs, ${failCount} failed`,
      data: results,
    });
  } catch (error) {
    console.error('Error in publish API:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Publish trigger API',
    usage: 'POST with optional body: { queueId?: string, platform?: string }',
    note: 'Defaults to YouTube only (instagram/facebook/youtube_shorts can be requested via platform param)',
    examples: {
      youtubeOnly: { platform: 'youtube' },
      instagram: { platform: 'instagram' },
      facebook: { platform: 'facebook' },
      specificJob: { queueId: 'job-id-here' },
    },
  });
}
