import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export interface WorkerTriggerResult {
  jobId: string;
  platform: string;
  endpoint?: string;
  success: boolean;
  response?: any;
  error?: string;
}

function mapPlatformToEndpoint(platform?: string): string | null {
  if (!platform) return null;

  if (platform === 'youtube' || platform === 'youtube_shorts') {
    return '/youtube/post';
  }

  if (platform === 'instagram' || platform === 'facebook') {
    return '/meta/post';
  }

  return null;
}

function normalizeStoragePath(filePath?: string | null): string | null {
  if (!filePath) return null;

  const decoded = decodeURIComponent(filePath);
  const marker = '/storage/v1/object/public/final_videos/';
  const index = decoded.indexOf(marker);
  if (index >= 0) {
    return decoded.substring(index + marker.length).split('?')[0];
  }

  if (decoded.startsWith('final_videos/')) {
    return decoded.substring('final_videos/'.length).split('?')[0];
  }

  return null;
}

export async function fetchDuePostingJobs(limit: number = 5, platformFilter?: string): Promise<any[]> {
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

  if (error) {
    throw new Error(`Failed to fetch due posting jobs: ${error.message}`);
  }

  let jobs = data || [];

  // Filter by platform if requested
  if (platformFilter) {
    jobs = jobs.filter(job => {
      if (platformFilter === 'youtube') {
        return job.platform === 'youtube' || job.platform === 'youtube_shorts';
      }
      return job.platform === platformFilter;
    });
  }

  return jobs;
}

export async function assertFinalVideoExists(job: any): Promise<{ ok: boolean; finalVideoPath?: string; error?: string }> {
  const nested = job?.videos_final;
  const video = Array.isArray(nested) ? nested[0] : nested;

  const finalVideoPath = video?.final_video_path || normalizeStoragePath(video?.file_path);
  if (!finalVideoPath) {
    return { ok: false, error: 'Missing final_video_path/file_path on job' };
  }

  const { data, error } = await supabase.storage.from('final_videos').download(finalVideoPath);

  if (error || !data) {
    return { ok: false, finalVideoPath, error: `Final video missing: ${error?.message || 'not found'}` };
  }

  return { ok: true, finalVideoPath };
}

export async function fetchPostingJobById(jobId: string): Promise<any> {
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

  if (error || !data) {
    throw new Error(`Job not found: ${jobId}`);
  }

  return data;
}

export async function triggerRailwayPost(jobId: string, platform?: string): Promise<WorkerTriggerResult> {
  const endpoint = mapPlatformToEndpoint(platform);
  if (!endpoint) {
    return {
      jobId,
      platform: platform || 'unknown',
      success: false,
      error: `Unsupported platform for worker posting: ${platform || 'unknown'}`,
    };
  }

  const workerBaseUrl = process.env.RAILWAY_WORKER_URL;
  const workerSecret = process.env.WORKER_SECRET;

  if (!workerBaseUrl) {
    return {
      jobId,
      platform: platform || 'unknown',
      endpoint,
      success: false,
      error: 'Missing RAILWAY_WORKER_URL',
    };
  }

  if (!workerSecret) {
    return {
      jobId,
      platform: platform || 'unknown',
      endpoint,
      success: false,
      error: 'Missing WORKER_SECRET',
    };
  }

  const response = await fetch(`${workerBaseUrl}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-worker-secret': workerSecret,
    },
    body: JSON.stringify({ jobId }),
  });

  const text = await response.text();
  let body: any = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }

  if (!response.ok) {
    return {
      jobId,
      platform: platform || 'unknown',
      endpoint,
      success: false,
      response: body,
      error: body?.error || `Worker request failed with ${response.status}`,
    };
  }

  return {
    jobId,
    platform: platform || 'unknown',
    endpoint,
    success: true,
    response: body,
  };
}

export async function triggerRailwayPostForQueueJob(jobId: string): Promise<WorkerTriggerResult> {
  const job = await fetchPostingJobById(jobId);
  const exists = await assertFinalVideoExists(job);

  if (!exists.ok) {
    return {
      jobId,
      platform: job.platform || 'unknown',
      success: false,
      error: exists.error,
    };
  }

  return triggerRailwayPost(jobId, job.platform);
}
