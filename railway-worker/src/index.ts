// cache-bust: 2026-03-04
// railway-worker/src/index.ts
// Express + FFmpeg worker — trims Pexels clips, burns captions, uploads to Supabase

import express from 'express';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffprobeInstaller from '@ffprobe-installer/ffprobe';
import ffmpeg from 'fluent-ffmpeg';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { getCompleteFilterChain } from './brandTemplates';
import FormData from 'form-data';

ffmpeg.setFfmpegPath(ffmpegInstaller.path);
ffmpeg.setFfprobePath(ffprobeInstaller.path);
console.log(`[worker] FFmpeg path: ${ffmpegInstaller.path}`);
console.log(`[worker] FFprobe path: ${ffprobeInstaller.path}`);
console.log(`[worker] FFmpeg version: ${ffmpegInstaller.version}`);

const app = express();
app.use(express.json({ limit: '10mb' }));

const PORT = process.env.PORT || 3001;
const WORKER_SECRET = process.env.WORKER_SECRET || '';
const PEXELS_API_KEY = process.env.PEXELS_API_KEY || '';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

let isProcessing = false;

interface WordCaption {
  word: string;
  start: number;
  end: number;
}

interface PostRequestBody {
  jobId?: string;
  final_video_path?: string;
  videoPath?: string;
  title?: string;
  description?: string;
  caption?: string;
}

interface PostingJob {
  id: string;
  platform?: string;
  status?: string;
  final_video_id?: string;
  videos_final?: {
    id?: string;
    file_path?: string;
    final_video_path?: string;
    analysis?: {
      hook?: string;
      caption?: string;
    };
  } | null;
}

class HttpError extends Error {
  status: number;
  responseBody?: string;

  constructor(message: string, status: number, responseBody?: string) {
    super(message);
    this.status = status;
    this.responseBody = responseBody;
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isRetryableError(error: unknown): boolean {
  if (error instanceof HttpError) {
    return error.status === 429 || (error.status >= 500 && error.status <= 599);
  }

  const msg = (error as any)?.message?.toLowerCase?.() || '';
  return msg.includes('timeout') || msg.includes('network') || msg.includes('econnreset') || msg.includes('fetch failed');
}

async function withRetry<T>(fn: () => Promise<T>, label: string, maxAttempts = 4): Promise<T> {
  let attempt = 0;
  let delayMs = 1500;

  while (true) {
    try {
      attempt += 1;
      return await fn();
    } catch (error) {
      if (attempt >= maxAttempts || !isRetryableError(error)) {
        throw error;
      }

      console.warn(`[worker] ${label} failed on attempt ${attempt}/${maxAttempts}, retrying in ${delayMs}ms`);
      await sleep(delayMs);
      delayMs = Math.min(delayMs * 2, 20000);
    }
  }
}

function requireSecret(req: express.Request, res: express.Response, next: express.NextFunction) {
  const headerValue = req.headers['x-worker-secret'];
  const secret = Array.isArray(headerValue) ? headerValue[0] : headerValue;

  if (!WORKER_SECRET || !secret || secret !== WORKER_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
}

function extractStoragePathFromUrl(videoUrl: string, bucket: string): string | null {
  if (!videoUrl) return null;

  const decoded = decodeURIComponent(videoUrl);
  const patterns = [
    `/storage/v1/object/public/${bucket}/`,
    `/storage/v1/object/authenticated/${bucket}/`,
    `/storage/v1/object/sign/${bucket}/`,
  ];

  for (const pattern of patterns) {
    const index = decoded.indexOf(pattern);
    if (index >= 0) {
      return decoded.substring(index + pattern.length).split('?')[0];
    }
  }

  if (decoded.startsWith(`${bucket}/`)) {
    return decoded.substring(bucket.length + 1).split('?')[0];
  }

  return null;
}

async function fetchJson(url: string, init?: RequestInit): Promise<any> {
  const res = await fetch(url, init);
  const text = await res.text();
  let data: any = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    throw new HttpError(`HTTP ${res.status} from ${url}`, res.status, text);
  }

  return data;
}

async function logJobEvent(jobId: string, level: 'info' | 'error', event: string, details?: Record<string, any>) {
  try {
    await supabase.from('job_logs').insert({
      job_id: jobId,
      level,
      event,
      details: details || {},
      created_at: new Date().toISOString(),
    });
  } catch (error: any) {
    console.warn(`[worker] Failed to write job_logs for ${jobId}: ${error?.message || 'unknown error'}`);
  }
}

async function updateQueueJob(jobId: string, patch: Record<string, any>) {
  const { error } = await supabase
    .from('posting_queue')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', jobId);

  if (error) {
    throw new Error(`Failed to update posting_queue ${jobId}: ${error.message}`);
  }
}

async function fetchPostingJob(jobId: string): Promise<PostingJob> {
  const { data, error } = await supabase
    .from('posting_queue')
    .select(`
      *,
      videos_final (*, analysis(hook, caption))
    `)
    .eq('id', jobId)
    .single();

  if (error || !data) {
    throw new Error(`Job not found: ${jobId}`);
  }

  return data as PostingJob;
}

function getFinalVideoPath(job: PostingJob, body: PostRequestBody): string | null {
  if (body.final_video_path) return body.final_video_path;

  const fromRow = job.videos_final?.final_video_path;
  if (fromRow) return fromRow;

  const filePath = job.videos_final?.file_path;
  if (filePath) {
    return extractStoragePathFromUrl(filePath, 'final_videos');
  }

  return null;
}

function getFinalPublicUrl(finalVideoPath: string): string {
  const { data } = supabase.storage.from('final_videos').getPublicUrl(finalVideoPath);
  return data.publicUrl;
}

async function downloadFinalVideoBuffer(finalVideoPath: string): Promise<Buffer> {
  const { data, error } = await supabase.storage
    .from('final_videos')
    .download(finalVideoPath);

  if (error || !data) {
    throw new Error(`Failed to download final video ${finalVideoPath}: ${error?.message || 'no data'}`);
  }

  return Buffer.from(await data.arrayBuffer());
}

function toYouTubeDescription(text?: string): string {
  const base = text?.trim() || 'The story nobody is telling. Follow for more.';
  return `${base}\n\n#Shorts #viral #news #whyitmatters`;
}

async function getYouTubeAccessToken(): Promise<string> {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  const refreshToken = process.env.YOUTUBE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Missing YOUTUBE_CLIENT_ID/YOUTUBE_CLIENT_SECRET/YOUTUBE_REFRESH_TOKEN');
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  const data = await withRetry(
    () => fetchJson('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    }),
    'youtube-token-refresh'
  );

  if (!data.access_token) {
    throw new Error('No access_token returned by Google OAuth token endpoint');
  }

  return data.access_token as string;
}

async function postToYouTubeFromBuffer(videoBuffer: Buffer, title: string, description: string): Promise<{ videoId: string; url: string }> {
  const accessToken = await getYouTubeAccessToken();

  const initRes = await withRetry(async () => {
    const res = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Upload-Content-Type': 'video/mp4',
        'X-Upload-Content-Length': String(videoBuffer.length),
      },
      body: JSON.stringify({
        snippet: {
          title: title.slice(0, 100),
          description,
          tags: ['shorts', 'viral', 'news', 'whyitmatters'],
          categoryId: '25',
        },
        status: {
          privacyStatus: 'public',
          selfDeclaredMadeForKids: false,
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new HttpError(`YouTube upload init failed`, res.status, errText);
    }

    return res;
  }, 'youtube-upload-init');

  const uploadUrl = initRes.headers.get('location');
  if (!uploadUrl) {
    throw new Error('No resumable upload URL from YouTube');
  }

  const uploadData = await withRetry(async () => {
    const res = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': String(videoBuffer.length),
      },
      body: new Uint8Array(videoBuffer),
    });

    const text = await res.text();
    let data: any = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }

    if (!res.ok || data.error) {
      throw new HttpError(`YouTube upload failed`, res.status, text);
    }

    return data;
  }, 'youtube-upload-put');

  const videoId = uploadData.id;
  if (!videoId) {
    throw new Error('YouTube upload response missing video id');
  }

  return {
    videoId,
    url: `https://www.youtube.com/shorts/${videoId}`,
  };
}

async function getMetaPageToken(): Promise<string> {
  const pageToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  if (!pageToken) {
    throw new Error('Missing FACEBOOK_PAGE_ACCESS_TOKEN');
  }
  return pageToken;
}

async function postInstagramReel(videoUrl: string, caption: string): Promise<{ mediaId: string; permalink?: string }> {
  const igUserId = process.env.META_IG_BUSINESS_ID || process.env.INSTAGRAM_USER_ID || process.env.INSTAGRAM_BUSINESS_ID;
  if (!igUserId) {
    throw new Error('Missing META_IG_BUSINESS_ID/INSTAGRAM_USER_ID/INSTAGRAM_BUSINESS_ID');
  }

  const accessToken = await getMetaPageToken();

  const containerData = await withRetry(
    () => fetchJson(`https://graph.facebook.com/v19.0/${igUserId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        media_type: 'REELS',
        video_url: videoUrl,
        caption,
        access_token: accessToken,
      }),
    }),
    'instagram-create-container'
  );

  const containerId = containerData.id;
  if (!containerId) {
    throw new Error('Instagram media container id missing');
  }

  let statusCode = 'IN_PROGRESS';
  let attempts = 0;

  while (statusCode !== 'FINISHED' && attempts < 24) {
    attempts += 1;
    await sleep(5000);

    const statusData = await withRetry(
      () => fetchJson(`https://graph.facebook.com/v19.0/${containerId}?fields=status_code&access_token=${accessToken}`),
      'instagram-container-status'
    );

    statusCode = statusData.status_code || 'IN_PROGRESS';

    if (statusCode === 'ERROR') {
      throw new Error('Instagram container processing failed');
    }
  }

  if (statusCode !== 'FINISHED') {
    throw new Error('Instagram container processing timed out');
  }

  const publishData = await withRetry(
    () => fetchJson(`https://graph.facebook.com/v19.0/${igUserId}/media_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creation_id: containerId,
        access_token: accessToken,
      }),
    }),
    'instagram-publish'
  );

  const mediaId = publishData.id;
  if (!mediaId) {
    throw new Error('Instagram publish response missing media id');
  }

  let permalink: string | undefined;
  try {
    const mediaInfo = await withRetry(
      () => fetchJson(`https://graph.facebook.com/v19.0/${mediaId}?fields=permalink&access_token=${accessToken}`),
      'instagram-permalink'
    );
    permalink = mediaInfo.permalink;
  } catch {
    permalink = undefined;
  }

  return { mediaId, permalink };
}

async function postFacebookVideo(videoUrl: string, description: string): Promise<{ postId: string; permalink?: string }> {
  const pageId = process.env.FACEBOOK_PAGE_ID || process.env.META_BUSINESS_FACEBOOK_ID;
  if (!pageId) {
    throw new Error('Missing FACEBOOK_PAGE_ID/META_BUSINESS_FACEBOOK_ID');
  }

  const accessToken = await getMetaPageToken();

  const data = await withRetry(
    () => fetchJson(`https://graph.facebook.com/v19.0/${pageId}/videos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        file_url: videoUrl,
        description,
        published: true,
        access_token: accessToken,
      }),
    }),
    'facebook-video-post'
  );

  const postId = data.post_id || data.id;
  if (!postId) {
    throw new Error('Facebook publish response missing post id');
  }

  let permalink: string | undefined;
  try {
    const permalinkData = await withRetry(
      () => fetchJson(`https://graph.facebook.com/v19.0/${postId}?fields=permalink_url&access_token=${accessToken}`),
      'facebook-permalink'
    );
    permalink = permalinkData.permalink_url;
  } catch {
    permalink = undefined;
  }

  return { postId, permalink };
}

function normalizeJobText(job: PostingJob, body: PostRequestBody): { title: string; description: string } {
  const hook = body.title || job.videos_final?.analysis?.hook || 'Why It Matters';
  const caption = body.description || body.caption || job.videos_final?.analysis?.caption || hook;
  return { title: hook, description: caption };
}

async function postYoutubeForJob(body: PostRequestBody): Promise<any> {
  const { jobId } = body;

  if (!jobId && !body.final_video_path && !body.videoPath) {
    throw new Error('Missing jobId or final_video_path/videoPath');
  }

  if (!jobId) {
    const sourceUrl = body.videoPath || getFinalPublicUrl(body.final_video_path!);
    const videoRes = await fetch(sourceUrl);
    if (!videoRes.ok) {
      throw new Error(`Unable to download video from ${sourceUrl}: ${videoRes.status}`);
    }
    const videoBuffer = Buffer.from(await videoRes.arrayBuffer());
    const title = body.title || 'Why It Matters';
    const description = toYouTubeDescription(body.description || body.caption);
    return postToYouTubeFromBuffer(videoBuffer, title, description);
  }

  const job = await fetchPostingJob(jobId);
  const finalVideoPath = getFinalVideoPath(job, body);
  if (!finalVideoPath) {
    throw new Error(`No final video path found for job ${jobId}`);
  }

  await updateQueueJob(jobId, { status: 'posting_youtube', last_error: null });
  await logJobEvent(jobId, 'info', 'posting_youtube_started', { final_video_path: finalVideoPath });

  try {
    const videoBuffer = await downloadFinalVideoBuffer(finalVideoPath);
    const text = normalizeJobText(job, body);

    const youtube = await postToYouTubeFromBuffer(
      videoBuffer,
      text.title,
      toYouTubeDescription(text.description)
    );

    await updateQueueJob(jobId, {
      status: 'posted_youtube',
      youtube_video_id: youtube.videoId,
      youtube_url: youtube.url,
      posted_at: new Date().toISOString(),
      error_message: null,
      last_error: null,
    });

    await logJobEvent(jobId, 'info', 'posting_youtube_success', {
      youtube_video_id: youtube.videoId,
      youtube_url: youtube.url,
    });

    // Sync analytics to Supabase (async, don't wait to block response)
    syncPostAnalytics(jobId).catch((err) => console.error('Analytics sync error:', err));

    return youtube;
  } catch (error: any) {
    const message = error?.message || 'Unknown YouTube posting failure';
    await updateQueueJob(jobId, {
      status: 'failed',
      error_message: message,
      last_error: message,
    });
    await logJobEvent(jobId, 'error', 'posting_youtube_failed', { error: message });
    throw error;
  }
}

async function postMetaForJob(body: PostRequestBody): Promise<any> {
  const { jobId } = body;

  if (!jobId && !body.final_video_path && !body.videoPath) {
    throw new Error('Missing jobId or final_video_path/videoPath');
  }

  if (!jobId) {
    const sourceUrl = body.videoPath || getFinalPublicUrl(body.final_video_path!);
    const caption = body.description || body.caption || body.title || 'Why It Matters';

    const [ig, fb] = await Promise.all([
      postInstagramReel(sourceUrl, caption),
      postFacebookVideo(sourceUrl, caption),
    ]);

    return {
      ig_media_id: ig.mediaId,
      ig_permalink: ig.permalink,
      fb_post_id: fb.postId,
      fb_permalink: fb.permalink,
    };
  }

  const job = await fetchPostingJob(jobId);
  const finalVideoPath = getFinalVideoPath(job, body);
  if (!finalVideoPath) {
    throw new Error(`No final video path found for job ${jobId}`);
  }

  const publicUrl = getFinalPublicUrl(finalVideoPath);
  const text = normalizeJobText(job, body);

  await updateQueueJob(jobId, { status: 'posting_meta', last_error: null });
  await logJobEvent(jobId, 'info', 'posting_meta_started', { final_video_path: finalVideoPath });

  try {
    const instagram = await postInstagramReel(publicUrl, text.description);
    const facebook = await postFacebookVideo(publicUrl, text.description);

    await updateQueueJob(jobId, {
      status: 'posted_meta',
      ig_media_id: instagram.mediaId,
      ig_permalink: instagram.permalink || null,
      fb_post_id: facebook.postId,
      fb_permalink: facebook.permalink || null,
      posted_at: new Date().toISOString(),
      error_message: null,
      last_error: null,
    });

    await logJobEvent(jobId, 'info', 'posting_meta_success', {
      ig_media_id: instagram.mediaId,
      fb_post_id: facebook.postId,
    });

    // Sync analytics to Supabase for both platforms (async, don't wait to block response)
    // Note: for Meta, we sync Instagram first; Facebook sync can happen on next refresh
    syncPostAnalytics(jobId).catch((err) => console.error('Analytics sync error:', err));

    return {
      ig_media_id: instagram.mediaId,
      ig_permalink: instagram.permalink,
      fb_post_id: facebook.postId,
      fb_permalink: facebook.permalink,
    };
  } catch (error: any) {
    const message = error?.message || 'Unknown Meta posting failure';
    await updateQueueJob(jobId, {
      status: 'failed',
      error_message: message,
      last_error: message,
    });
    await logJobEvent(jobId, 'error', 'posting_meta_failed', { error: message });
    throw error;
  }
}

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', busy: isProcessing });
});

app.get('/debug', (_req, res) => {
  const { execSync } = require('child_process');
  let memInfo = 'unavailable';
  let diskInfo = 'unavailable';

  try {
    memInfo = execSync('cat /proc/meminfo | grep -E "MemTotal|MemAvailable|MemFree"').toString().trim();
  } catch {}

  try {
    diskInfo = execSync('df -h /tmp').toString().trim();
  } catch {}

  const ffmpegSizeMB = (() => {
    try {
      return (fs.statSync(ffmpegInstaller.path).size / 1024 / 1024).toFixed(1) + 'MB';
    } catch {
      return 'unknown';
    }
  })();

  const mem = process.memoryUsage();

  res.json({
    status: 'ok',
    busy: isProcessing,
    ffmpegPath: ffmpegInstaller.path,
    ffmpegVersion: ffmpegInstaller.version,
    ffmpegBinarySize: ffmpegSizeMB,
    memInfo: memInfo.split('\n'),
    diskInfo,
    nodeMemory: {
      heapUsedMB: (mem.heapUsed / 1024 / 1024).toFixed(1),
      heapTotalMB: (mem.heapTotal / 1024 / 1024).toFixed(1),
      rssMB: (mem.rss / 1024 / 1024).toFixed(1),
      externalMB: (mem.external / 1024 / 1024).toFixed(1),
    },
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.version,
    tmpDir: os.tmpdir(),
  });
});

async function resolvePexelsUrl(videoId: string): Promise<string> {
  const normalizedId = String(videoId).replace(/^pexels_/i, '').match(/\d+/)?.[0] || String(videoId);

  const res = await fetch(`https://api.pexels.com/videos/videos/${normalizedId}`, {
    headers: { Authorization: PEXELS_API_KEY },
  });

  if (!res.ok) {
    throw new Error(`Pexels API error ${res.status} for video ${videoId} (normalized: ${normalizedId})`);
  }

  const data: any = await res.json();
  const files: any[] = data.video_files || [];

  const hd = files.find((f: any) => f.quality === 'hd') || files.find((f: any) => f.quality === 'sd') || files[0];

  if (!hd?.link) {
    throw new Error(`No download URL for Pexels video ${videoId}`);
  }

  return hd.link;
}

async function downloadToTemp(url: string, suffix: string): Promise<string> {
  const tmpPath = path.join(os.tmpdir(), `wim_${Date.now()}${suffix}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${url}`);

  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(tmpPath, buffer);
  console.log(`[worker] Downloaded ${(buffer.length / 1024 / 1024).toFixed(1)}MB → ${tmpPath}`);
  return tmpPath;
}

function buildDrawtextFilter(captions: WordCaption[], fallbackHook: string): string {
  if (captions && captions.length > 0) {
    const MAX_CAPTION_TOKENS = 120;
    const validCaptions = captions.filter(({ word, start, end }) => {
      return (
        typeof word === 'string' &&
        word.trim().length > 0 &&
        Number.isFinite(start) &&
        Number.isFinite(end) &&
        end > start
      );
    });

    const cappedCaptions = validCaptions.slice(0, MAX_CAPTION_TOKENS);
    if (validCaptions.length > MAX_CAPTION_TOKENS) {
      console.log(`[worker] Caption tokens capped: ${validCaptions.length} -> ${MAX_CAPTION_TOKENS}`);
    }

    return cappedCaptions
      .map(({ word, start, end }) => {
        const safe = word
          .replace(/[\r\n\t]/g, ' ')
          .replace(/\\/g, '\\\\')
          .replace(/'/g, '\u2019')
          .replace(/:/g, '\\:')
          .replace(/\[/g, '\\[')
          .replace(/\]/g, '\\]')
          .replace(/,/g, '\\,')
          .replace(/;/g, '\\;')
          .replace(/=/g, '\\=')
          .replace(/%/g, '\\%')
          .trim();

        if (!safe) {
          return '';
        }

        return (
          `drawtext=text='${safe}'` +
          `:font=monospace` +
          `:fontsize=58` +
          `:fontcolor=white` +
          `:borderw=3` +
          `:bordercolor=black@0.8` +
          `:shadowx=2:shadowy=2` +
          `:x=(w-text_w)/2` +
          `:y=h*0.80` +
          `:enable='between(t\\,${start}\\,${end})'`
        );
      })
      .filter(Boolean)
      .join(',');
  }

  // Before building drawtext, wrap the hook into lines of max 35 chars
  const words = fallbackHook.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if ((current + ' ' + word).length > 35) {
      lines.push(current);
      current = word;
    } else {
      current = current ? current + ' ' + word : word;
    }
  }
  lines.push(current);
  const wrappedHook = lines.join('\\n');

  const safeHook = wrappedHook
    .replace(/[\r\t]/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, '\u2019')
    .replace(/:/g, '\\:')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
    .replace(/=/g, '\\=')
    .replace(/%/g, '\\%');

  return (
    `drawtext=text='${safeHook}'` +
    `:font=monospace` +
    `:fontsize=46` +
    `:fontcolor=white` +
    `:borderw=3` +
    `:bordercolor=black@0.8` +
    `:shadowx=2:shadowy=2` +
    `:x=(w-text_w)/2` +
    `:y=h*0.15` +
    `:enable=1`
  );
}

async function transcribeWithWhisper(filePath: string, startTime: number): Promise<WordCaption[]> {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    console.warn('[worker] OPENAI_API_KEY not set — skipping Whisper transcription');
    return [];
  }

  try {
    console.log('[worker] Transcribing with Whisper...');
    const fileStream = fs.createReadStream(filePath);

    const formData = new FormData();
    formData.append('file', fileStream as any, { filename: 'clip.mp4', contentType: 'video/mp4' } as any);
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'verbose_json');
    formData.append('timestamp_granularities[]', 'word');

    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        ...formData.getHeaders(),
      },
      body: formData as any,
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[worker] Whisper API error ${res.status}: ${errText}`);
      return [];
    }

    const data: any = await res.json();
    console.log('[worker] Whisper raw keys:', Object.keys(data));
    console.log('[worker] Whisper word count:', data.words?.length ?? 'undefined');
    
    const words: WordCaption[] = (data.words || [])
      .filter((w: any) => w.word && typeof w.start === 'number' && typeof w.end === 'number')
      .map((w: any) => ({
        word: w.word.trim(),
        start: w.start,
        end: w.end,
      }));

    console.log(`[worker] Whisper returned ${words.length} word captions`);
    return words;
  } catch (err: any) {
    console.error('[worker] Whisper transcription failed:', err.message);
    return [];
  }
}

function trimAndCaptionVideo(
  inputPath: string,
  outputPath: string,
  startTime: number,
  duration: number,
  drawtextFilter: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const videoFilter = drawtextFilter
      ? drawtextFilter
      : `scale=1080:608:force_original_aspect_ratio=decrease:flags=lanczos,pad=1080:1920:0:656:black`;

    ffmpeg(inputPath)
      .seekInput(startTime)
      .duration(duration)
      .videoFilter(videoFilter)
      .videoCodec('libx264')
      .addOption('-preset', 'fast')
      .addOption('-crf', '23')
      .addOption('-pix_fmt', 'yuv420p')
      .addOption('-threads', '2')
      .addOption('-movflags', '+faststart')
      .addOption('-fs', '50M')
      .addOption('-f', 'lavfi')
      .addOption('-i', 'anullsrc=r=44100:cl=stereo')
      .addOption('-filter_complex', '[0:a][1:a]amix=inputs=2:duration=first:dropout_transition=0[aout]')
      .addOption('-map', '0:v')
      .addOption('-map', '[aout]')
      .addOption('-c:a', 'aac')
      .addOption('-b:a', '128k')
      .addOption('-shortest')
      .output(outputPath)
      .on('start', cmd => console.log('[worker] FFmpeg command:', cmd))
      .on('progress', p => console.log(`[worker] FFmpeg progress: ${p.percent?.toFixed(0) ?? '?'}%`))
      .on('end', () => {
        console.log('[worker] FFmpeg finished');
        resolve();
      })
      .on('error', (err, _stdout, stderr) => {
        console.error('[worker] FFmpeg stderr:', stderr);
        reject(new Error(`FFmpeg failed: ${err.message}`));
      })
      .run();
  });
}

async function getVideoDuration(filePath: string): Promise<number> {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        console.error('[worker] ffprobe error:', err);
        console.log('[worker] Defaulting to 10 seconds since ffprobe failed');
        resolve(10); // Default to 10 seconds if ffprobe fails
        return;
      }
      const duration = metadata.format.duration || 10;
      console.log(`[worker] Video duration: ${duration.toFixed(2)}s`);
      resolve(duration);
    });
  });
}

async function uploadToSupabase(filePath: string, videoId: string): Promise<{ publicUrl: string; storagePath: string }> {
  const fileBuffer = fs.readFileSync(filePath);
  const storagePath = `${videoId}/final.mp4`;

  const { error } = await supabase.storage
    .from('final_videos')
    .upload(storagePath, fileBuffer, {
      contentType: 'video/mp4',
      upsert: true,
    });

  if (error) throw new Error(`Supabase upload failed: ${error.message}`);

  // Verify upload succeeded by checking metadata
  console.log('[worker] Verifying upload...');
  const { data: metadata, error: metadataError } = await supabase.storage
    .from('final_videos')
    .list(videoId);

  if (metadataError) {
    throw new Error(`Failed to verify upload: ${metadataError.message}`);
  }

  const uploadedFile = metadata?.find(f => f.name === 'final.mp4');
  if (!uploadedFile) {
    throw new Error('Uploaded file not found in storage');
  }

  const fileSizeBytes = uploadedFile.metadata?.size || 0;
  if (!fileSizeBytes || fileSizeBytes === 0) {
    throw new Error('Uploaded file is zero bytes or missing size');
  }

  console.log(`[worker] Upload verified: ${(fileSizeBytes / 1024 / 1024).toFixed(2)}MB`);

  const { data } = supabase.storage.from('final_videos').getPublicUrl(storagePath);
  return { publicUrl: data.publicUrl, storagePath };
}

async function saveVideoRecord(
  videoId: string,
  analysisId: string,
  videoUrl: string,
  finalVideoPath: string,
  hook: string,
  caption: string,
  viralityScore: number,
  durationSeconds: number,
  hasSubtitles: boolean
): Promise<void> {
  if (!durationSeconds || Number.isNaN(durationSeconds) || durationSeconds <= 0) {
    throw new Error(`Invalid duration from ffprobe: ${durationSeconds}`);
  }

  const nowIso = new Date().toISOString();

  const { data: analysisRow, error: analysisError } = await supabase
    .from('analysis')
    .select('segment_id')
    .eq('id', analysisId)
    .single();

  if (analysisError || !analysisRow?.segment_id) {
    throw new Error(`Failed to resolve segment_id for analysis ${analysisId}: ${analysisError?.message || 'missing segment_id'}`);
  }

  const finalInsertPayload = {
    id: videoId,
    analysis_id: analysisId,
    segment_id: analysisRow.segment_id,
    file_path: videoUrl,
    final_video_path: finalVideoPath,
    status: 'ready',
    has_subtitles: hasSubtitles,
    duration_seconds: durationSeconds,
    produced_at: nowIso,
    error_message: null,
    created_at: nowIso,
    updated_at: nowIso,
  };

  const { error: finalError } = await supabase.from('videos_final').insert(finalInsertPayload);

  if (finalError) {
    const missingFinalPathColumn =
      finalError.message.includes("Could not find the 'final_video_path' column") ||
      finalError.message.includes('schema cache');

    if (!missingFinalPathColumn) {
      throw new Error(`Supabase insert to videos_final failed: ${finalError.message}`);
    }

    console.warn('[worker] videos_final schema cache may be stale; retrying insert without final_video_path');

    const { final_video_path: _ignored, ...fallbackPayload } = finalInsertPayload;
    const { error: fallbackError } = await supabase.from('videos_final').insert(fallbackPayload);

    if (fallbackError) {
      throw new Error(`Supabase insert to videos_final failed: ${fallbackError.message}`);
    }
  }

  await supabase.from('produced_videos').insert({
    id: videoId,
    analysis_id: analysisId,
    video_url: videoUrl,
    status: 'complete',
    hook,
    caption,
    virality_score: viralityScore,
    platforms_posted: [],
    created_at: nowIso,
  });
}

// ==========================
// Analytics Fetchers
// ==========================

interface YouTubeStats {
  views: number;
  likes: number;
  comments: number;
}

interface InstagramStats {
  impressions: number;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
}

interface FacebookStats {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  reach: number;
}

async function fetchYouTubeStats(videoId: string, accessToken: string): Promise<YouTubeStats> {
  try {
    const url = new URL('https://www.googleapis.com/youtube/v3/videos');
    url.searchParams.append('part', 'statistics');
    url.searchParams.append('id', videoId);
    url.searchParams.append('access_token', accessToken);

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`YouTube API error: ${response.status}`);
    }

    const data = await response.json();
    if (!data.items || data.items.length === 0) {
      return { views: 0, likes: 0, comments: 0 };
    }

    const stats = data.items[0].statistics;
    return {
      views: parseInt(stats.viewCount || '0', 10),
      likes: parseInt(stats.likeCount || '0', 10),
      comments: parseInt(stats.commentCount || '0', 10),
    };
  } catch (error: any) {
    console.error('YOUTUBE_STATS_ERROR', { videoId, error: error.message });
    return { views: 0, likes: 0, comments: 0 };
  }
}

async function fetchInstagramStats(mediaId: string, accessToken: string): Promise<InstagramStats> {
  try {
    const url = new URL(`https://graph.instagram.com/v19.0/${mediaId}`);
    url.searchParams.append('fields', 'insights.metric(impressions,reach,engagement,saves),like_count,comments_count,from');
    url.searchParams.append('access_token', accessToken);

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`Instagram API error: ${response.status}`);
    }

    const data = await response.json();
    const insights = data.insights?.data || [];
    
    const insightMap: { [key: string]: number } = {};
    insights.forEach((insight: any) => {
      insightMap[insight.name] = insight.values?.[0]?.value || 0;
    });

    return {
      impressions: insightMap.impressions || 0,
      reach: insightMap.reach || 0,
      likes: data.like_count || 0,
      comments: data.comments_count || 0,
      shares: 0, // Instagram API doesn't expose share count
      saves: insightMap.saves || 0,
    };
  } catch (error: any) {
    console.error('INSTAGRAM_STATS_ERROR', { mediaId, error: error.message });
    return { impressions: 0, reach: 0, likes: 0, comments: 0, shares: 0, saves: 0 };
  }
}

async function fetchFacebookStats(postId: string, accessToken: string): Promise<FacebookStats> {
  try {
    const url = new URL(`https://graph.facebook.com/v19.0/${postId}`);
    url.searchParams.append('fields', 'shares,likes.summary(true),comments.summary(true),insights.metric(post_impressions_unique,post_clicks,post_reactions,post_video_views)');
    url.searchParams.append('access_token', accessToken);

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`Facebook API error: ${response.status}`);
    }

    const data = await response.json();
    const insights = data.insights?.data || [];

    const insightMap: { [key: string]: number } = {};
    insights.forEach((insight: any) => {
      insightMap[insight.name] = insight.values?.[0]?.value || 0;
    });

    return {
      views: insightMap.post_video_views || 0,
      likes: data.likes?.summary?.total_count || 0,
      comments: data.comments?.summary?.total_count || 0,
      shares: data.shares?.data?.length || 0,
      reach: insightMap.post_impressions_unique || 0,
    };
  } catch (error: any) {
    console.error('FACEBOOK_STATS_ERROR', { postId, error: error.message });
    return { views: 0, likes: 0, comments: 0, shares: 0, reach: 0 };
  }
}

async function syncPostAnalytics(jobId: string): Promise<void> {
  try {
    // Fetch job details
    const { data: job, error: jobError } = await supabase
      .from('posting_queue')
      .select('*')
      .eq('id', jobId)
      .single();

    if (jobError) {
      throw new Error(`Failed to fetch job: ${jobError.message}`);
    }

    const { platform, youtube_video_id, ig_media_id, fb_post_id, posted_at } = job;
    const now = new Date().toISOString();

    // Determine which platform and fetch stats
    let stats: any = {
      job_id: jobId,
      platform,
      posted_at: posted_at || now,
      stats_fetched_at: now,
    };

    if (platform === 'youtube' || platform === 'youtube_shorts') {
      if (youtube_video_id) {
        const ytToken = await getYouTubeAccessToken();
        const ytStats = await fetchYouTubeStats(youtube_video_id, ytToken);
        stats.youtube_views = ytStats.views;
        stats.youtube_likes = ytStats.likes;
        stats.youtube_comments = ytStats.comments;
        stats.youtube_video_id = youtube_video_id;
      }
    } else if (platform === 'instagram') {
      if (ig_media_id) {
        const metaToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
        if (metaToken) {
          const igStats = await fetchInstagramStats(ig_media_id, metaToken);
          stats.ig_impressions = igStats.impressions;
          stats.ig_reach = igStats.reach;
          stats.ig_likes = igStats.likes;
          stats.ig_comments = igStats.comments;
          stats.ig_shares = igStats.shares;
          stats.ig_saves = igStats.saves;
          stats.ig_media_id = ig_media_id;
        }
      }
    } else if (platform === 'facebook') {
      if (fb_post_id) {
        const metaToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
        if (metaToken) {
          const fbStats = await fetchFacebookStats(fb_post_id, metaToken);
          stats.fb_views = fbStats.views;
          stats.fb_likes = fbStats.likes;
          stats.fb_comments = fbStats.comments;
          stats.fb_shares = fbStats.shares;
          stats.fb_reach = fbStats.reach;
          stats.fb_post_id = fb_post_id;
        }
      }
    }

    // Calculate totals and engagement rate
    const totalViews = (stats.youtube_views || 0) + (stats.ig_impressions || 0) + (stats.fb_views || 0);
    const totalEngagements =
      (stats.youtube_likes || 0) +
      (stats.youtube_comments || 0) +
      (stats.ig_likes || 0) +
      (stats.ig_comments || 0) +
      (stats.ig_shares || 0) +
      (stats.ig_saves || 0) +
      (stats.fb_likes || 0) +
      (stats.fb_comments || 0) +
      (stats.fb_shares || 0);

    stats.total_views = totalViews;
    stats.total_engagements = totalEngagements;
    stats.engagement_rate = totalViews > 0 ? ((totalEngagements / totalViews) * 100).toFixed(2) : 0;

    // Insert or update in post_analytics table
    const { error: insertError } = await supabase.from('post_analytics').upsert(
      [{ job_id: jobId, ...stats }],
      { onConflict: 'job_id' }
    );

    if (insertError) {
      throw new Error(`Failed to sync analytics: ${insertError.message}`);
    }

    await logJobEvent(jobId, 'info', 'analytics_synced', {
      platform,
      total_views: totalViews,
      total_engagements: totalEngagements,
    });
  } catch (error: any) {
    console.error('SYNC_ANALYTICS_ERROR', { jobId, error: error.message });
    // Don't throw - analytics sync failure shouldn't block posting
    await logJobEvent(jobId, 'error', 'analytics_sync_failed', { error: error.message }).catch(() => {});
  }
}

app.post('/youtube/post', requireSecret, async (req, res) => {
  try {
    const result = await postYoutubeForJob(req.body as PostRequestBody);
    return res.json({ success: true, platform: 'youtube', result });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error?.message || 'YouTube post failed' });
  }
});

app.post('/meta/post', requireSecret, async (req, res) => {
  try {
    const result = await postMetaForJob(req.body as PostRequestBody);
    return res.json({ success: true, platform: 'meta', result });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error?.message || 'Meta post failed' });
  }
});

app.post('/post/all', requireSecret, async (req, res) => {
  try {
    const body = req.body as PostRequestBody;
    const youtube = await postYoutubeForJob(body);
    const meta = await postMetaForJob(body);
    return res.json({ success: true, youtube, meta });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error?.message || 'Post all failed' });
  }
});

// Periodic stats refresh endpoint
app.post('/stats/refresh', requireSecret, async (req, res) => {
  try {
    const { hoursOld = 2, daysBack = 7 } = req.body || {};
    
    // Find posts that haven't been synced in N hours, posted in last N days
    const cutoffDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();
    const syncCutoffDate = new Date(Date.now() - hoursOld * 60 * 60 * 1000).toISOString();

    const { data: jobs, error: queryError } = await supabase
      .from('posting_queue')
      .select('id, platform, youtube_video_id, ig_media_id, fb_post_id')
      .in('status', ['posted_youtube', 'posted_meta'])
      .gte('posted_at', cutoffDate)
      .lt('posted_at', syncCutoffDate);

    if (queryError) {
      throw new Error(`Failed to fetch jobs: ${queryError.message}`);
    }

    const refreshed: string[] = [];
    const failed: string[] = [];

    for (const job of jobs || []) {
      try {
        await syncPostAnalytics(job.id);
        refreshed.push(job.id);
      } catch (error: any) {
        console.error(`Failed to refresh stats for ${job.id}:`, error.message);
        failed.push(job.id);
      }
    }

    return res.json({
      success: true,
      refreshed: refreshed.length,
      failed: failed.length,
      jobsProcessed: refreshed.length + failed.length,
      failedIds: failed,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error?.message || 'Stats refresh failed' });
  }
});

app.post('/produce', requireSecret, async (req, res) => {
  if (isProcessing) {
    res.setHeader('Retry-After', '30');
    return res.status(429).json({ error: 'Worker busy', retryAfter: 30 });
  }

  const {
    analysisId,
    filePath,
    sourceId,
    startTime = 0,
    endTime = 10,
    hook,
    caption,
    explanation,
    contentPillar,
    viralityScore = 0,
    captions = [],
  } = req.body;

  if (!analysisId || (!filePath && !sourceId) || !hook) {
    return res.status(400).json({
      error: 'Missing required fields: analysisId, sourceId (or filePath), hook',
    });
  }

  const pexelsId = sourceId || (filePath?.startsWith('pexels://') ? filePath.replace('pexels://', '') : null);

  if (!pexelsId) {
    return res.status(400).json({ error: 'Cannot resolve Pexels video ID' });
  }

  isProcessing = true;
  const videoId = uuidv4();
  const inputPath = path.join(os.tmpdir(), `wim_input_${videoId}.mp4`);
  const outputPath = path.join(os.tmpdir(), `wim_output_${videoId}.mp4`);

  console.log(`\n[worker] ═══ Starting job ═══`);
  console.log(`[worker] Analysis: ${analysisId}`);
  console.log(`[worker] Pexels ID: ${pexelsId}`);
  console.log(`[worker] Segment: ${startTime}s → ${endTime}s`);
  console.log(`[worker] Captions: ${captions.length} words from Whisper`);
  console.log(`[worker] Hook: ${hook}`);

  res.json({ success: true, videoId, message: 'Job started' });

  try {
    const duration = endTime - startTime;

    console.log('[worker] Resolving Pexels URL...');
    const pexelsUrl = await resolvePexelsUrl(pexelsId);

    console.log('[worker] Downloading input clip...');
    await downloadToTemp(pexelsUrl, '.mp4').then(p => fs.renameSync(p, inputPath));

    const inputSizeMB = (fs.statSync(inputPath).size / 1024 / 1024).toFixed(1);
    console.log(`[worker] Input file: ${inputSizeMB}MB`);

    // Run Whisper transcription on the downloaded clip
    const whisperCaptions = await transcribeWithWhisper(inputPath, startTime);
    const finalCaptions = whisperCaptions.length > 0 ? whisperCaptions : captions;
    console.log(`[worker] Using ${finalCaptions.length} captions (${whisperCaptions.length > 0 ? 'Whisper' : 'fallback from request'})`);

    const drawtextFilter = getCompleteFilterChain(
      {
        hook,
        context: explanation || caption || '',
        contentPillar: contentPillar || 'Breaking',
        videoDuration: duration,
        addOutro: true,
      },
      finalCaptions.length > 0 ? finalCaptions : undefined
    );
    let hasSubtitles = true;

    console.log('[worker] Running FFmpeg...');
    try {
      await trimAndCaptionVideo(inputPath, outputPath, startTime, duration, drawtextFilter);
    } catch (renderError: any) {
      console.error('[worker] Drawtext render failed, retrying without subtitles:', renderError?.message || renderError);
      hasSubtitles = false;
      await trimAndCaptionVideo(inputPath, outputPath, startTime, duration, '');
    }

    const outputSizeMB = (fs.statSync(outputPath).size / 1024 / 1024).toFixed(1);
    console.log(`[worker] Output file: ${outputSizeMB}MB`);

    console.log('[worker] Getting video duration...');
    const durationSeconds = await getVideoDuration(outputPath);

    console.log('[worker] Uploading to Supabase...');
    const upload = await uploadToSupabase(outputPath, videoId);
    console.log(`[worker] Uploaded: ${upload.publicUrl}`);

    await saveVideoRecord(
      videoId,
      analysisId,
      upload.publicUrl,
      upload.storagePath,
      hook,
      caption || hook,
      viralityScore,
      durationSeconds,
      hasSubtitles
    );
    console.log(`[worker] ✓ Job complete. Video ID: ${videoId}`);
  } catch (err: any) {
    console.error(`[worker] ✗ Job failed: ${err.message}`);

    try {
      await supabase.from('produced_videos').insert({
        id: videoId,
        analysis_id: analysisId,
        status: 'failed',
        hook,
        error_message: err.message,
        created_at: new Date().toISOString(),
      });
    } catch {}
  } finally {
    for (const p of [inputPath, outputPath]) {
      try {
        if (fs.existsSync(p)) fs.unlinkSync(p);
      } catch {}
    }
    isProcessing = false;
    console.log('[worker] ═══ Job slot released ═══\n');
  }
});

app.listen(PORT, () => {
  console.log(`[worker] Server running on port ${PORT}`);
  console.log(`[worker] FFmpeg ready at ${ffmpegInstaller.path}`);
  console.log(`[worker] Supabase: ${process.env.SUPABASE_URL ? '✓' : '✗ MISSING'}`);
  console.log(`[worker] Pexels:   ${PEXELS_API_KEY ? '✓' : '✗ MISSING'}`);
  console.log(`[worker] Secret:   ${WORKER_SECRET ? '✓' : '✗ MISSING'}`);
});
