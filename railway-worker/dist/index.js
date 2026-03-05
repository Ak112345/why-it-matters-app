"use strict";
// cache-bust: 2026-03-05
// railway-worker/src/index.ts
// Express + FFmpeg worker — trims Pexels clips, applies branded templates, burns captions, uploads to Supabase

import express from 'express';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffprobeInstaller from '@ffprobe-installer/ffprobe';
import ffmpeg from 'fluent-ffmpeg';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';
import FormData from 'form-data';

import {
  getCompleteFilterChain,
  getYouTubeCompleteFilterChain,
  WordCaption,
} from './brandTemplates';

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

type RenderFormat = 'vertical' | 'youtube';

class HttpError extends Error {
  status: number;
  responseBody?: string;

  constructor(message: string, status: number, responseBody?: string) {
    super(message);
    this.status = status;
    this.responseBody = responseBody;
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isRetryableError(error: unknown) {
  if (error instanceof HttpError) {
    return error.status === 429 || (error.status >= 500 && error.status <= 599);
  }

  const msg = getErrorMessage(error).toLowerCase();
  return (
    msg.includes('timeout') ||
    msg.includes('network') ||
    msg.includes('econnreset') ||
    msg.includes('fetch failed')
  );
}

async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  maxAttempts = 4
): Promise<T> {
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

      console.warn(
        `[worker] ${label} failed on attempt ${attempt}/${maxAttempts}, retrying in ${delayMs}ms`
      );

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

function normalizeRenderFormat(value: unknown): RenderFormat {
  return value === 'youtube' ? 'youtube' : 'vertical';
}

function extractStoragePathFromUrl(videoUrl: string | null | undefined, bucket: string) {
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

async function logJobEvent(jobId: string, level: string, event: string, details?: Record<string, any>) {
  try {
    await supabase.from('job_logs').insert({
      job_id: jobId,
      level,
      event,
      details: details || {},
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.warn(
      `[worker] Failed to write job_logs for ${jobId}: ${getErrorMessage(error)}`
    );
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

async function fetchPostingJob(jobId: string): Promise<any> {
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

  return data;
}

function getFinalVideoPath(job: any, body: any) {
  if (body.final_video_path) return body.final_video_path;

  const fromRow = job.videos_final?.final_video_path;
  if (fromRow) return fromRow;

  const filePath = job.videos_final?.file_path;
  if (filePath) {
    return extractStoragePathFromUrl(filePath, 'final_videos');
  }

  return null;
}

function getFinalPublicUrl(finalVideoPath: string) {
  const { data } = supabase.storage.from('final_videos').getPublicUrl(finalVideoPath);
  return data.publicUrl;
}

async function downloadFinalVideoBuffer(finalVideoPath: string) {
  const { data, error } = await supabase.storage
    .from('final_videos')
    .download(finalVideoPath);

  if (error || !data) {
    throw new Error(
      `Failed to download final video ${finalVideoPath}: ${error?.message || 'no data'}`
    );
  }

  return Buffer.from(await data.arrayBuffer());
}

function toYouTubeDescription(text?: string) {
  const base = text?.trim() || 'The story nobody is telling. Follow for more.';
  return `${base}\n\n#Shorts #viral #news #whyitmatters`;
}

async function getYouTubeAccessToken() {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  const refreshToken = process.env.YOUTUBE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      'Missing YOUTUBE_CLIENT_ID/YOUTUBE_CLIENT_SECRET/YOUTUBE_REFRESH_TOKEN'
    );
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  const data = await withRetry(
    () =>
      fetchJson('https://oauth2.googleapis.com/token', {
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

async function postToYouTubeFromBuffer(videoBuffer: Buffer, title: string, description: string) {
  const accessToken = await getYouTubeAccessToken();

  const initRes = await withRetry(
    async () => {
      const res = await fetch(
        'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
        {
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
        }
      );

      if (!res.ok) {
        const errText = await res.text();
        throw new HttpError(`YouTube upload init failed`, res.status, errText);
      }

      return res;
    },
    'youtube-upload-init'
  );

  const uploadUrl = initRes.headers.get('location');
  if (!uploadUrl) {
    throw new Error('No resumable upload URL from YouTube');
  }

  const uploadData = await withRetry(
    async () => {
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
    },
    'youtube-upload-put'
  );

  const videoId = uploadData.id;
  if (!videoId) {
    throw new Error('YouTube upload response missing video id');
  }

  return {
    videoId,
    url: `https://www.youtube.com/shorts/${videoId}`,
  };
}

async function getMetaPageToken() {
  const pageToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  if (!pageToken) {
    throw new Error('Missing FACEBOOK_PAGE_ACCESS_TOKEN');
  }
  return pageToken;
}

async function postInstagramReel(videoUrl: string, caption: string) {
  const igUserId =
    process.env.META_IG_BUSINESS_ID ||
    process.env.INSTAGRAM_USER_ID ||
    process.env.INSTAGRAM_BUSINESS_ID;

  if (!igUserId) {
    throw new Error(
      'Missing META_IG_BUSINESS_ID/INSTAGRAM_USER_ID/INSTAGRAM_BUSINESS_ID'
    );
  }

  const accessToken = await getMetaPageToken();

  const containerData = await withRetry(
    () =>
      fetchJson(`https://graph.facebook.com/v19.0/${igUserId}/media`, {
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
      () =>
        fetchJson(
          `https://graph.facebook.com/v19.0/${containerId}?fields=status_code&access_token=${accessToken}`
        ),
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
    () =>
      fetchJson(`https://graph.facebook.com/v19.0/${igUserId}/media_publish`, {
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
      () =>
        fetchJson(
          `https://graph.facebook.com/v19.0/${mediaId}?fields=permalink&access_token=${accessToken}`
        ),
      'instagram-permalink'
    );
    permalink = mediaInfo.permalink;
  } catch {
    permalink = undefined;
  }

  return { mediaId, permalink };
}

async function postFacebookVideo(videoUrl: string, description: string) {
  const pageId =
    process.env.FACEBOOK_PAGE_ID || process.env.META_BUSINESS_FACEBOOK_ID;

  if (!pageId) {
    throw new Error('Missing FACEBOOK_PAGE_ID/META_BUSINESS_FACEBOOK_ID');
  }

  const accessToken = await getMetaPageToken();

  const data = await withRetry(
    () =>
      fetchJson(`https://graph.facebook.com/v19.0/${pageId}/videos`, {
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
      () =>
        fetchJson(
          `https://graph.facebook.com/v19.0/${postId}?fields=permalink_url&access_token=${accessToken}`
        ),
      'facebook-permalink'
    );
    permalink = permalinkData.permalink_url;
  } catch {
    permalink = undefined;
  }

  return { postId, permalink };
}

function normalizeJobText(job: any, body: any) {
  const hook = body.title || job.videos_final?.analysis?.hook || 'Why It Matters';
  const caption =
    body.description || body.caption || job.videos_final?.analysis?.caption || hook;

  return { title: hook, description: caption };
}

async function postYoutubeForJob(body: any) {
  const { jobId } = body;

  if (!jobId && !body.final_video_path && !body.videoPath) {
    throw new Error('Missing jobId or final_video_path/videoPath');
  }

  if (!jobId) {
    const sourceUrl = body.videoPath || getFinalPublicUrl(body.final_video_path);
    const videoRes = await fetch(sourceUrl);

    if (!videoRes.ok) {
      throw new Error(
        `Unable to download video from ${sourceUrl}: ${videoRes.status}`
      );
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
  await logJobEvent(jobId, 'info', 'posting_youtube_started', {
    final_video_path: finalVideoPath,
  });

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

    syncPostAnalytics(jobId).catch(err =>
      console.error('Analytics sync error:', getErrorMessage(err))
    );

    return youtube;
  } catch (error) {
    const message = getErrorMessage(error);

    await updateQueueJob(jobId, {
      status: 'failed',
      error_message: message,
      last_error: message,
    });

    await logJobEvent(jobId, 'error', 'posting_youtube_failed', {
      error: message,
    });

    throw error;
  }
}

async function postMetaForJob(body: any) {
  const { jobId } = body;

  if (!jobId && !body.final_video_path && !body.videoPath) {
    throw new Error('Missing jobId or final_video_path/videoPath');
  }

  if (!jobId) {
    const sourceUrl = body.videoPath || getFinalPublicUrl(body.final_video_path);
    const caption =
      body.description || body.caption || body.title || 'Why It Matters';

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
  await logJobEvent(jobId, 'info', 'posting_meta_started', {
    final_video_path: finalVideoPath,
  });

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

    syncPostAnalytics(jobId).catch(err =>
      console.error('Analytics sync error:', getErrorMessage(err))
    );

    return {
      ig_media_id: instagram.mediaId,
      ig_permalink: instagram.permalink,
      fb_post_id: facebook.postId,
      fb_permalink: facebook.permalink,
    };
  } catch (error) {
    const message = getErrorMessage(error);

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
    memInfo = execSync(
      'cat /proc/meminfo | grep -E "MemTotal|MemAvailable|MemFree"'
    )
      .toString()
      .trim();
  } catch {}

  try {
    diskInfo = execSync('df -h /tmp').toString().trim();
  } catch {}

  const ffmpegSizeMB = (() => {
    try {
      return (
        (fs.statSync(ffmpegInstaller.path).size / 1024 / 1024).toFixed(1) + 'MB'
      );
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

async function resolvePexelsUrl(videoId: string) {
  const normalizedId =
    String(videoId).replace(/^pexels_/i, '').match(/\d+/)?.[0] || String(videoId);

  const res = await fetch(`https://api.pexels.com/videos/videos/${normalizedId}`, {
    headers: { Authorization: PEXELS_API_KEY },
  });

  if (!res.ok) {
    throw new Error(
      `Pexels API error ${res.status} for video ${videoId} (normalized: ${normalizedId})`
    );
  }

  const data = await res.json();
  const files = data.video_files || [];
  const hd =
    files.find((f: any) => f.quality === 'hd') ||
    files.find((f: any) => f.quality === 'sd') ||
    files[0];

  if (!hd?.link) {
    throw new Error(`No download URL for Pexels video ${videoId}`);
  }

  return hd.link as string;
}

async function downloadToTemp(url: string, suffix: string) {
  const tmpPath = path.join(os.tmpdir(), `wim_${Date.now()}${suffix}`);
  const res = await fetch(url);

  if (!res.ok) throw new Error(`Download failed: ${res.status} ${url}`);

  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(tmpPath, buffer);

  console.log(
    `[worker] Downloaded ${(buffer.length / 1024 / 1024).toFixed(1)}MB → ${tmpPath}`
  );

  return tmpPath;
}

async function transcribeWithWhisper(filePath: string, _startTime: number): Promise<WordCaption[]> {
  const openaiApiKey = process.env.OPENAI_API_KEY;

  if (!openaiApiKey) {
    console.warn('[worker] OPENAI_API_KEY not set — skipping Whisper transcription');
    return [];
  }

  try {
    console.log('[worker] Transcribing with Whisper...');

    const fileStream = fs.createReadStream(filePath);
    const formData = new FormData();

    formData.append('file', fileStream, {
      filename: 'clip.mp4',
      contentType: 'video/mp4',
    });
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
      .filter(
        (w: any) =>
          w.word &&
          typeof w.start === 'number' &&
          typeof w.end === 'number'
      )
      .map((w: any) => ({
        word: String(w.word).trim(),
        start: w.start,
        end: w.end,
      }));

    console.log(`[worker] Whisper returned ${words.length} word captions`);
    return words;
  } catch (err) {
    console.error('[worker] Whisper transcription failed:', getErrorMessage(err));
    return [];
  }
}

function getPlainFallbackFilter(renderFormat: RenderFormat): string {
  if (renderFormat === 'youtube') {
    return [
      'scale=1920:800:force_original_aspect_ratio=decrease:flags=lanczos',
      'pad=1920:800:(ow-iw)/2:(oh-ih)/2:black',
      'pad=1920:1080:(ow-iw)/2:120:black',
    ].join(',');
  }

  return [
    'scale=1080:608:force_original_aspect_ratio=decrease:flags=lanczos',
    'pad=1080:1920:(ow-iw)/2:656:black',
  ].join(',');
}

function buildRenderFilters(params: {
  renderFormat: RenderFormat;
  hook: string;
  context: string;
  contentPillar?: string;
  videoDuration: number;
  captions?: WordCaption[];
}) {
  const baseOptions = {
    hook: params.hook,
    context: params.context || '',
    contentPillar: params.contentPillar || 'Breaking',
    videoDuration: params.videoDuration,
    addOutro: true,
  };

  if (params.renderFormat === 'youtube') {
    return {
      fullFilter: getYouTubeCompleteFilterChain(
        baseOptions,
        params.captions && params.captions.length ? params.captions : undefined
      ),
      brandOnlyFilter: getYouTubeCompleteFilterChain(baseOptions, undefined),
      plainFallbackFilter: getPlainFallbackFilter('youtube'),
    };
  }

  return {
    fullFilter: getCompleteFilterChain(
      baseOptions,
      params.captions && params.captions.length ? params.captions : undefined
    ),
    brandOnlyFilter: getCompleteFilterChain(baseOptions, undefined),
    plainFallbackFilter: getPlainFallbackFilter('vertical'),
  };
}

function trimAndCaptionVideo(
  inputPath: string,
  outputPath: string,
  startTime: number,
  duration: number,
  videoFilter: string
) {
  return new Promise<void>((resolve, reject) => {
    console.log('[worker] Applying video filter:');
    console.log(videoFilter);

    ffmpeg(inputPath)
      .seekInput(startTime)
      .duration(duration)
      .input('anullsrc=r=44100:cl=stereo')
      .inputFormat('lavfi')
      .videoFilters(videoFilter)
      .outputOptions([
        '-map 0:v:0',
        '-map 1:a:0',
        '-c:v libx264',
        '-preset fast',
        '-crf 23',
        '-pix_fmt yuv420p',
        '-threads 2',
        '-movflags +faststart',
        '-c:a aac',
        '-b:a 128k',
        '-shortest',
        '-fs 50M',
      ])
      .output(outputPath)
      .on('start', cmd => console.log('[worker] FFmpeg command:', cmd))
      .on('progress', p =>
        console.log(`[worker] FFmpeg progress: ${p.percent?.toFixed(0) ?? '?'}%`)
      )
      .on('end', () => {
        console.log('[worker] FFmpeg finished');
        resolve();
      })
      .on('error', (err, stdout, stderr) => {
        console.error('[worker] FFmpeg stdout:', stdout);
        console.error('[worker] FFmpeg stderr:', stderr);
        reject(new Error(`FFmpeg failed: ${err.message}`));
      })
      .run();
  });
}

async function getVideoDuration(filePath: string) {
  return new Promise<number>(resolve => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        console.error('[worker] ffprobe error:', err);
        console.log('[worker] Defaulting to 10 seconds since ffprobe failed');
        resolve(10);
        return;
      }

      const duration = metadata.format.duration || 10;
      console.log(`[worker] Video duration: ${duration.toFixed(2)}s`);
      resolve(duration);
    });
  });
}

async function uploadToSupabase(filePath: string, videoId: string) {
  const fileBuffer = fs.readFileSync(filePath);
  const storagePath = `${videoId}/final.mp4`;

  const { error } = await supabase.storage.from('final_videos').upload(storagePath, fileBuffer, {
    contentType: 'video/mp4',
    upsert: true,
  });

  if (error) {
    throw new Error(`Supabase upload failed: ${error.message}`);
  }

  console.log('[worker] Verifying upload...');

  const { data: metadata, error: metadataError } = await supabase.storage
    .from('final_videos')
    .list(videoId);

  if (metadataError) {
    throw new Error(`Failed to verify upload: ${metadataError.message}`);
  }

  const uploadedFile = metadata?.find((f: any) => f.name === 'final.mp4');
  if (!uploadedFile) {
    throw new Error('Uploaded file not found in storage');
  }

  const fileSizeBytes = uploadedFile.metadata?.size || 0;
  if (!fileSizeBytes || fileSizeBytes === 0) {
    throw new Error('Uploaded file is zero bytes or missing size');
  }

  console.log(
    `[worker] Upload verified: ${(fileSizeBytes / 1024 / 1024).toFixed(2)}MB`
  );

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
) {
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
    throw new Error(
      `Failed to resolve segment_id for analysis ${analysisId}: ${analysisError?.message || 'missing segment_id'}`
    );
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

    console.warn(
      '[worker] videos_final schema cache may be stale; retrying insert without final_video_path'
    );

    const { final_video_path: _ignored, ...fallbackPayload } = finalInsertPayload as any;
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

async function fetchYouTubeStats(videoId: string, accessToken: string) {
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
  } catch (error) {
    console.error('YOUTUBE_STATS_ERROR', {
      videoId,
      error: getErrorMessage(error),
    });

    return { views: 0, likes: 0, comments: 0 };
  }
}

async function fetchInstagramStats(mediaId: string, accessToken: string) {
  try {
    const url = new URL(`https://graph.instagram.com/v19.0/${mediaId}`);
    url.searchParams.append(
      'fields',
      'insights.metric(impressions,reach,engagement,saves),like_count,comments_count,from'
    );
    url.searchParams.append('access_token', accessToken);

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`Instagram API error: ${response.status}`);
    }

    const data = await response.json();
    const insights = data.insights?.data || [];
    const insightMap: Record<string, number> = {};

    insights.forEach((insight: any) => {
      insightMap[insight.name] = insight.values?.[0]?.value || 0;
    });

    return {
      impressions: insightMap.impressions || 0,
      reach: insightMap.reach || 0,
      likes: data.like_count || 0,
      comments: data.comments_count || 0,
      shares: 0,
      saves: insightMap.saves || 0,
    };
  } catch (error) {
    console.error('INSTAGRAM_STATS_ERROR', {
      mediaId,
      error: getErrorMessage(error),
    });

    return {
      impressions: 0,
      reach: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      saves: 0,
    };
  }
}

async function fetchFacebookStats(postId: string, accessToken: string) {
  try {
    const url = new URL(`https://graph.facebook.com/v19.0/${postId}`);
    url.searchParams.append(
      'fields',
      'shares,likes.summary(true),comments.summary(true),insights.metric(post_impressions_unique,post_clicks,post_reactions,post_video_views)'
    );
    url.searchParams.append('access_token', accessToken);

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`Facebook API error: ${response.status}`);
    }

    const data = await response.json();
    const insights = data.insights?.data || [];
    const insightMap: Record<string, number> = {};

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
  } catch (error) {
    console.error('FACEBOOK_STATS_ERROR', {
      postId,
      error: getErrorMessage(error),
    });

    return { views: 0, likes: 0, comments: 0, shares: 0, reach: 0 };
  }
}

async function syncPostAnalytics(jobId: string) {
  try {
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

    const stats: Record<string, any> = {
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

    const totalViews =
      (stats.youtube_views || 0) + (stats.ig_impressions || 0) + (stats.fb_views || 0);

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
    stats.engagement_rate =
      totalViews > 0 ? ((totalEngagements / totalViews) * 100).toFixed(2) : 0;

    const { error: insertError } = await supabase
      .from('post_analytics')
      .upsert([{ job_id: jobId, ...stats }], { onConflict: 'job_id' });

    if (insertError) {
      throw new Error(`Failed to sync analytics: ${insertError.message}`);
    }

    await logJobEvent(jobId, 'info', 'analytics_synced', {
      platform,
      total_views: totalViews,
      total_engagements: totalEngagements,
    });
  } catch (error) {
    console.error('SYNC_ANALYTICS_ERROR', {
      jobId,
      error: getErrorMessage(error),
    });

    await logJobEvent(jobId, 'error', 'analytics_sync_failed', {
      error: getErrorMessage(error),
    }).catch(() => {});
  }
}

app.post('/youtube/post', requireSecret, async (req, res) => {
  try {
    const result = await postYoutubeForJob(req.body);
    return res.json({ success: true, platform: 'youtube', result });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: getErrorMessage(error) || 'YouTube post failed',
    });
  }
});

app.post('/meta/post', requireSecret, async (req, res) => {
  try {
    const result = await postMetaForJob(req.body);
    return res.json({ success: true, platform: 'meta', result });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: getErrorMessage(error) || 'Meta post failed',
    });
  }
});

app.post('/post/all', requireSecret, async (req, res) => {
  try {
    const body = req.body;
    const youtube = await postYoutubeForJob(body);
    const meta = await postMetaForJob(body);
    return res.json({ success: true, youtube, meta });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: getErrorMessage(error) || 'Post all failed',
    });
  }
});

app.post('/stats/refresh', requireSecret, async (req, res) => {
  try {
    const { hoursOld = 2, daysBack = 7 } = req.body || {};

    const cutoffDate = new Date(
      Date.now() - daysBack * 24 * 60 * 60 * 1000
    ).toISOString();

    const syncCutoffDate = new Date(
      Date.now() - hoursOld * 60 * 60 * 1000
    ).toISOString();

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
      } catch (error) {
        console.error(
          `Failed to refresh stats for ${job.id}:`,
          getErrorMessage(error)
        );
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
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: getErrorMessage(error) || 'Stats refresh failed',
    });
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
    renderFormat: rawRenderFormat = 'vertical',
  } = req.body;

  if (!analysisId || (!filePath && !sourceId) || !hook) {
    return res.status(400).json({
      error: 'Missing required fields: analysisId, sourceId (or filePath), hook',
    });
  }

  const renderFormat = normalizeRenderFormat(rawRenderFormat);

  const pexelsId =
    sourceId ||
    (filePath?.startsWith('pexels://') ? filePath.replace('pexels://', '') : null);

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
  console.log(`[worker] Hook: ${hook}`);
  console.log(`[worker] Render format: ${renderFormat}`);
  console.log(`[worker] Captions from request: ${captions.length}`);

  res.json({
    success: true,
    videoId,
    message: 'Job started',
    renderFormat,
  });

  try {
    const duration = endTime - startTime;

    console.log('[worker] Resolving Pexels URL...');
    const pexelsUrl = await resolvePexelsUrl(pexelsId);

    console.log('[worker] Downloading input clip...');
    await downloadToTemp(pexelsUrl, '.mp4').then(p => fs.renameSync(p, inputPath));

    const inputSizeMB = (fs.statSync(inputPath).size / 1024 / 1024).toFixed(1);
    console.log(`[worker] Input file: ${inputSizeMB}MB`);

    const whisperCaptions = await transcribeWithWhisper(inputPath, startTime);
    const finalCaptions: WordCaption[] =
      whisperCaptions.length > 0 ? whisperCaptions : captions;

    console.log(
      `[worker] Using ${finalCaptions.length} captions (${whisperCaptions.length > 0 ? 'Whisper' : 'fallback from request'})`
    );

    const { fullFilter, brandOnlyFilter, plainFallbackFilter } = buildRenderFilters({
      renderFormat,
      hook,
      context: explanation || caption || '',
      contentPillar: contentPillar || 'Breaking',
      videoDuration: duration,
      captions: finalCaptions.length > 0 ? finalCaptions : undefined,
    });

    let hasSubtitles = finalCaptions.length > 0;
    let renderModeUsed: 'full' | 'brand-only' | 'plain' = 'full';

    console.log('[worker] Running FFmpeg with full branded filter...');
    try {
      await trimAndCaptionVideo(inputPath, outputPath, startTime, duration, fullFilter);
    } catch (fullError) {
      console.error('[worker] Full render failed:', getErrorMessage(fullError));
      console.log('[worker] Retrying with brand-only filter...');
      hasSubtitles = false;
      renderModeUsed = 'brand-only';

      try {
        await trimAndCaptionVideo(
          inputPath,
          outputPath,
          startTime,
          duration,
          brandOnlyFilter
        );
      } catch (brandError) {
        console.error('[worker] Brand-only render failed:', getErrorMessage(brandError));
        console.log('[worker] Final retry with plain fallback filter...');
        renderModeUsed = 'plain';

        await trimAndCaptionVideo(
          inputPath,
          outputPath,
          startTime,
          duration,
          plainFallbackFilter
        );
      }
    }

    console.log(`[worker] Render mode used: ${renderModeUsed}`);

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
  } catch (err) {
    console.error(`[worker] ✗ Job failed: ${getErrorMessage(err)}`);

    try {
      await supabase.from('produced_videos').insert({
        id: videoId,
        analysis_id: analysisId,
        status: 'failed',
        hook,
        error_message: getErrorMessage(err),
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

app.post('/produce-youtube', requireSecret, async (req, res) => {
  try {
    const body = req.body;

    if (!body.analysisId || !body.sourceId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: analysisId, sourceId',
      });
    }

    console.log(`[/produce-youtube] Processing job: ${body.analysisId}`);

    const produceBody = {
      analysisId: body.analysisId,
      sourceId: body.sourceId,
      startTime: body.startTime || 0,
      endTime: body.endTime || 10,
      hook: body.hook || 'Why It Matters',
      caption: body.caption,
      explanation: body.explanation,
      contentPillar: body.contentPillar,
      viralityScore: body.viralityScore || 0,
      captions: body.captions || [],
      renderFormat: 'youtube',
    };

    const produceRes = await fetch(`http://localhost:${PORT}/produce`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-worker-secret': WORKER_SECRET,
      },
      body: JSON.stringify(produceBody),
    });

    const produceData = await produceRes.json();

    return res.json({
      success: true,
      ...produceData,
      renderFormat: 'youtube',
    });
  } catch (error) {
    console.error('[/produce-youtube] Error:', getErrorMessage(error));

    return res.status(500).json({
      success: false,
      error: getErrorMessage(error) || 'Failed to produce YouTube video',
    });
  }
});

app.listen(PORT, () => {
  console.log(`[worker] Listening on port ${PORT}`);
});
