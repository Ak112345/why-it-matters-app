// src/production/produceVideo.ts
// Handles: Whisper caption generation + Railway worker job dispatch

import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const RAILWAY_URL = process.env.RAILWAY_WORKER_URL || 'https://why-it-matters-worker-production.up.railway.app';
const WORKER_SECRET = process.env.WORKER_SECRET!;

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface ProduceJobInput {
  analysisId: string;
  source: string;        // 'pexels'
  sourceId: string;      // e.g. '6462490'
  startTime: number;
  endTime: number;
  hook: string;
  caption: string;
  viralityScore: number;
}

export interface WordCaption {
  word: string;
  start: number;
  end: number;
}

export interface ProduceJobResult {
  success: boolean;
  videoId?: string;
  error?: string;
}

// ─────────────────────────────────────────────
// Step 1: Resolve Pexels video download URL
// ─────────────────────────────────────────────

async function resolvePexelsUrl(videoId: string): Promise<string> {
  const res = await fetch(`https://api.pexels.com/videos/videos/${videoId}`, {
    headers: { Authorization: process.env.PEXELS_API_KEY! },
  });

  if (!res.ok) {
    throw new Error(`Pexels API error ${res.status} for video ${videoId}`);
  }

  const data = await res.json();

  // Prefer HD, fall back to SD
  const files: any[] = data.video_files || [];
  const hd = files.find((f: any) => f.quality === 'hd') ||
              files.find((f: any) => f.quality === 'sd') ||
              files[0];

  if (!hd?.link) {
    throw new Error(`No download URL found for Pexels video ${videoId}`);
  }

  return hd.link;
}

// ─────────────────────────────────────────────
// Step 2: Download clip segment to temp file
// ─────────────────────────────────────────────

async function downloadClipSegment(
  url: string,
  startTime: number,
  endTime: number
): Promise<string> {
  const tmpPath = path.join(os.tmpdir(), `whisper_clip_${Date.now()}.mp4`);

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download clip: ${res.status}`);

  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(tmpPath, buffer);

  console.log(`[produceVideo] Downloaded clip to ${tmpPath} (${(buffer.length / 1024 / 1024).toFixed(1)}MB)`);
  return tmpPath;
}

// ─────────────────────────────────────────────
// Step 3: Get word-timed captions from Whisper
// ─────────────────────────────────────────────

async function getWhisperCaptions(clipPath: string): Promise<WordCaption[]> {
  console.log('[produceVideo] Sending clip to Whisper API...');

  try {
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(clipPath),
      model: 'whisper-1',
      response_format: 'verbose_json',
      timestamp_granularities: ['word'],
    });

    const words = (transcription as any).words as Array<{
      word: string;
      start: number;
      end: number;
    }>;

    if (!words || words.length === 0) {
      console.log('[produceVideo] Whisper returned no words — video may be silent. Using hook as fallback.');
      return [];
    }

    console.log(`[produceVideo] Whisper returned ${words.length} words`);

    return words.map(w => ({
      word: w.word.trim(),
      start: w.start,
      end: w.end,
    }));
  } catch (err: any) {
    // Non-fatal: if Whisper fails, Railway will use hook text as static caption
    console.error('[produceVideo] Whisper failed (non-fatal):', err.message);
    return [];
  } finally {
    // Always clean up temp file
    try { fs.unlinkSync(clipPath); } catch {}
  }
}

// ─────────────────────────────────────────────
// Step 4: Dispatch job to Railway worker
// ─────────────────────────────────────────────

async function dispatchToRailway(
  job: ProduceJobInput,
  captions: WordCaption[]
): Promise<ProduceJobResult> {
  console.log(`[produceVideo] Dispatching job to Railway for analysis ${job.analysisId}`);

  const payload = {
    analysisId: job.analysisId,
    filePath: `pexels://${job.sourceId}`,  // kept for backward compat
    source: job.source,
    sourceId: job.sourceId,
    startTime: job.startTime,
    endTime: job.endTime,
    hook: job.hook,
    caption: job.caption,
    viralityScore: job.viralityScore,
    captions,  // word-timed from Whisper (empty array = Railway uses hook text fallback)
  };

  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    attempts++;

    const res = await fetch(`${RAILWAY_URL}/produce`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-worker-secret': WORKER_SECRET,
      },
      body: JSON.stringify(payload),
    });

    if (res.status === 429) {
      // Worker busy — wait and retry
      const retryAfter = parseInt(res.headers.get('retry-after') || '30', 10);
      console.log(`[produceVideo] Worker busy, retrying in ${retryAfter}s (attempt ${attempts}/${maxAttempts})`);
      await new Promise(r => setTimeout(r, retryAfter * 1000));
      continue;
    }

    const data = await res.json();

    if (!res.ok) {
      return {
        success: false,
        error: data.error || `Railway returned HTTP ${res.status}`,
      };
    }

    return {
      success: true,
      videoId: data.videoId || data.jobId,
    };
  }

  return { success: false, error: 'Worker busy after max retries' };
}

// ─────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────

export async function produceVideo(job: ProduceJobInput): Promise<ProduceJobResult> {
  console.log(`[produceVideo] Starting production for analysis ${job.analysisId}`);

  try {
    // 1. Resolve Pexels download URL
    const pexelsUrl = await resolvePexelsUrl(job.sourceId);

    // 2. Download the segment for Whisper
    const tmpClipPath = await downloadClipSegment(pexelsUrl, job.startTime, job.endTime);

    // 3. Get word-timed captions (non-blocking — falls back gracefully)
    const captions = await getWhisperCaptions(tmpClipPath);

    // 4. Send job + captions to Railway worker
    const result = await dispatchToRailway(job, captions);

    if (result.success) {
      console.log(`[produceVideo] Job dispatched successfully. Video ID: ${result.videoId}`);
    } else {
      console.error(`[produceVideo] Job failed: ${result.error}`);
    }

    return result;
  } catch (err: any) {
    console.error('[produceVideo] Unexpected error:', err);
    return { success: false, error: err.message };
  }
}