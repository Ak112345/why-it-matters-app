// cache-bust: 2026-03-02
// railway-worker/src/index.ts
// Express + FFmpeg worker — trims Pexels clips, burns captions, uploads to Supabase

import express from 'express';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffmpeg from 'fluent-ffmpeg';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';

// ─────────────────────────────────────────────
// Set FFmpeg path immediately — MUST be before any ffmpeg usage
// ─────────────────────────────────────────────
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
console.log(`[worker] FFmpeg path: ${ffmpegInstaller.path}`);
console.log(`[worker] FFmpeg version: ${ffmpegInstaller.version}`);

// ─────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────
const app = express();
app.use(express.json({ limit: '10mb' }));

const PORT = process.env.PORT || 3001;
const WORKER_SECRET = process.env.WORKER_SECRET!;
const PEXELS_API_KEY = process.env.PEXELS_API_KEY!;

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ─────────────────────────────────────────────
// Job queue — only 1 job at a time
// ─────────────────────────────────────────────
let isProcessing = false;

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface WordCaption {
  word: string;
  start: number;
  end: number;
}

// ─────────────────────────────────────────────
// Auth middleware
// ─────────────────────────────────────────────
function requireSecret(req: express.Request, res: express.Response, next: express.NextFunction) {
  const secret = req.headers['x-worker-secret'];
  if (!WORKER_SECRET || secret !== WORKER_SECRET) {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  next();
}

// ─────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', busy: isProcessing });
});

app.get('/debug', (_req, res) => {
  const { execSync } = require('child_process');
  let memInfo = 'unavailable';
  let diskInfo = 'unavailable';

  try {
    memInfo = execSync('cat /proc/meminfo | grep -E "MemTotal|MemAvailable|MemFree"')
      .toString().trim();
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

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

async function resolvePexelsUrl(videoId: string): Promise<string> {
  const res = await fetch(`https://api.pexels.com/videos/videos/${videoId}`, {
    headers: { Authorization: PEXELS_API_KEY },
  });

  if (!res.ok) {
    throw new Error(`Pexels API error ${res.status} for video ${videoId}`);
  }

  const data: any = await res.json();
  const files: any[] = data.video_files || [];

  const hd = files.find((f: any) => f.quality === 'hd') ||
              files.find((f: any) => f.quality === 'sd') ||
              files[0];

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
  // If we have word-timed captions from Whisper, use them
  if (captions && captions.length > 0) {
    return captions.map(({ word, start, end }) => {
      // Escape special chars for FFmpeg drawtext
      const safe = word
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\u2019")
        .replace(/:/g, '\\:')
        .replace(/\[/g, '\\[')
        .replace(/\]/g, '\\]')
        .replace(/,/g, '\\,');

      return (
        `drawtext=text='${safe}'` +
        `:fontsize=58` +
        `:fontcolor=white` +
        `:borderw=3` +
        `:bordercolor=black@0.8` +
        `:shadowx=2:shadowy=2` +
        `:x=(w-text_w)/2` +
        `:y=h*0.80` +
        `:enable='between(t\\,${start}\\,${end})'`
      );
    }).join(',');
  }

  // Fallback: static hook text centered near bottom
  const safeHook = fallbackHook
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\u2019")
    .replace(/:/g, '\\:')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/,/g, '\\,')
    .substring(0, 80); // cap length

  return (
    `drawtext=text='${safeHook}'` +
    `:fontsize=46` +
    `:fontcolor=white` +
    `:borderw=3` +
    `:bordercolor=black@0.8` +
    `:shadowx=2:shadowy=2` +
    `:x=(w-text_w)/2` +
    `:y=h*0.80` +
    `:enable=1`
  );
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
      ? `scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2,${drawtextFilter}`
      : `scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2`;

    ffmpeg(inputPath)
      .seekInput(startTime)
      .duration(duration)
      .videoFilter(videoFilter)
      .audioCodec('aac')
      .audioBitrate('128k')
      .videoCodec('libx264')
      .addOption('-preset', 'fast')
      .addOption('-crf', '23')
      .addOption('-pix_fmt', 'yuv420p')
      .addOption('-threads', '2')
      .addOption('-movflags', '+faststart')
      .addOption('-fs', '50M')
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

async function uploadToSupabase(filePath: string, videoId: string): Promise<string> {
  const fileBuffer = fs.readFileSync(filePath);
  const storagePath = `videos/${videoId}.mp4`;

  const { error } = await supabase.storage
    .from('final_videos')
    .upload(storagePath, fileBuffer, {
      contentType: 'video/mp4',
      upsert: true,
    });

  if (error) throw new Error(`Supabase upload failed: ${error.message}`);

  const { data } = supabase.storage.from('final_videos').getPublicUrl(storagePath);
  return data.publicUrl;
}

async function saveVideoRecord(
  videoId: string,
  analysisId: string,
  videoUrl: string,
  hook: string,
  caption: string,
  viralityScore: number
): Promise<void> {
  const { error } = await supabase
    .from('produced_videos')
    .insert({
      id: videoId,
      analysis_id: analysisId,
      video_url: videoUrl,
      status: 'complete',
      hook,
      caption,
      virality_score: viralityScore,
      platforms_posted: [],
      created_at: new Date().toISOString(),
    });

  if (error) throw new Error(`Supabase insert failed: ${error.message}`);
}

// ─────────────────────────────────────────────
// POST /produce — main job endpoint
// ─────────────────────────────────────────────

app.post('/produce', requireSecret, async (req, res) => {
  // One job at a time
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
    viralityScore = 0,
    captions = [],  // WordCaption[] from Whisper via produceVideo.ts
  } = req.body;

  // Validation
  if (!analysisId || (!filePath && !sourceId) || !hook) {
    return res.status(400).json({
      error: 'Missing required fields: analysisId, sourceId (or filePath), hook',
    });
  }

  // Extract pexels video ID from either sourceId or filePath
  const pexelsId = sourceId ||
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
  console.log(`[worker] Captions: ${captions.length} words from Whisper`);
  console.log(`[worker] Hook: ${hook}`);

  // Respond immediately so caller isn't left hanging
  // The job runs asynchronously
  res.json({ success: true, videoId, message: 'Job started' });

  try {
    const duration = endTime - startTime;

    // 1. Resolve Pexels URL
    console.log('[worker] Resolving Pexels URL...');
    const pexelsUrl = await resolvePexelsUrl(pexelsId);

    // 2. Download input clip
    console.log('[worker] Downloading input clip...');
    await downloadToTemp(pexelsUrl, '.mp4').then(p => fs.renameSync(p, inputPath));

    // 3. Check file size
    const inputSizeMB = (fs.statSync(inputPath).size / 1024 / 1024).toFixed(1);
    console.log(`[worker] Input file: ${inputSizeMB}MB`);

    // 4. Build caption filter
    const drawtextFilter = buildDrawtextFilter(captions, hook);

    // 5. Run FFmpeg
    console.log('[worker] Running FFmpeg...');
    await trimAndCaptionVideo(inputPath, outputPath, startTime, duration, drawtextFilter);

    // 6. Check output size
    const outputSizeMB = (fs.statSync(outputPath).size / 1024 / 1024).toFixed(1);
    console.log(`[worker] Output file: ${outputSizeMB}MB`);

    // 7. Upload to Supabase
    console.log('[worker] Uploading to Supabase...');
    const videoUrl = await uploadToSupabase(outputPath, videoId);
    console.log(`[worker] Uploaded: ${videoUrl}`);

    // 8. Save record to DB
    await saveVideoRecord(videoId, analysisId, videoUrl, hook, caption || hook, viralityScore);
    console.log(`[worker] ✓ Job complete. Video ID: ${videoId}`);

  } catch (err: any) {
    console.error(`[worker] ✗ Job failed: ${err.message}`);

    // Mark as failed in DB
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
    // Always clean up temp files and release lock
    for (const p of [inputPath, outputPath]) {
      try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch {}
    }
    isProcessing = false;
    console.log('[worker] ═══ Job slot released ═══\n');
  }
});

// ─────────────────────────────────────────────
// Start server
// ─────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`[worker] Server running on port ${PORT}`);
  console.log(`[worker] FFmpeg ready at ${ffmpegInstaller.path}`);
  console.log(`[worker] Supabase: ${process.env.SUPABASE_URL ? '✓' : '✗ MISSING'}`);
  console.log(`[worker] Pexels:   ${PEXELS_API_KEY ? '✓' : '✗ MISSING'}`);
  console.log(`[worker] Secret:   ${WORKER_SECRET ? '✓' : '✗ MISSING'}`);
});