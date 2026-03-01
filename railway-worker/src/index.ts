import express, { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { v4 as uuidv4 } from 'uuid';
import { createClient } from '@supabase/supabase-js';
import ffmpeg from 'fluent-ffmpeg';

const requiredEnv = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'WORKER_SECRET'];
for (const key of requiredEnv) {
  if (!process.env[key]) { console.error(`Missing env var: ${key}`); process.exit(1); }
}

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

interface ProduceRequest {
  analysisId: string;
  // New: source info for direct download
  source: string;
  sourceId: string;
  startTime: number;
  endTime: number;
  pexelsApiKey?: string;
  // Legacy fallback
  segmentUrl?: string;
  filePath: string;
  hook: string;
  caption: string;
  explanation: string;
  addSubtitles: boolean;
  addHookOverlay: boolean;
}

const app = express();
app.use(express.json({ limit: '10mb' }));

app.get('/health', (_req: Request, res: Response) => res.json({ status: 'ok' }));

function requireSecret(req: Request, res: Response, next: NextFunction): void {
  if (req.headers['x-worker-secret'] !== process.env.WORKER_SECRET) {
    res.status(401).json({ error: 'Unauthorized' }); return;
  }
  next();
}

/**
 * Resolve a direct video download URL from source + sourceId
 */
async function resolveDownloadUrl(source: string, sourceId: string, pexelsApiKey?: string): Promise<string> {
  if (source === 'pexels') {
    const apiKey = pexelsApiKey || process.env.PEXELS_API_KEY;
    if (!apiKey) throw new Error('No Pexels API key available');

    // sourceId may be "pexels_12345283" or "12345283"
    const numericId = sourceId.replace(/^pexels_/, '');

    const response = await fetch(`https://api.pexels.com/videos/videos/${numericId}`, {
      headers: { Authorization: apiKey },
    });

    if (!response.ok) throw new Error(`Pexels API error: ${response.status} for ID ${numericId}`);

    const data = await response.json() as any;
    const hdFile = data.video_files?.find(
      (f: any) => f.quality === 'hd' && f.file_type === 'video/mp4'
    ) || data.video_files?.find(
      (f: any) => f.file_type === 'video/mp4'
    ) || data.video_files?.[0];

    if (!hdFile?.link) throw new Error(`No downloadable file found for Pexels ID ${numericId}`);
    return hdFile.link;
  }

  if (source === 'internet_archive') {
    // Try standard Archive.org URL pattern
    return `https://archive.org/download/${sourceId}/${sourceId}.mp4`;
  }

  throw new Error(`Unsupported source: ${source}`);
}

app.post('/produce', requireSecret, async (req: Request, res: Response) => {
  const {
    analysisId, source, sourceId, startTime = 0, endTime = 10,
    pexelsApiKey, segmentUrl, filePath, hook, addHookOverlay
  }: ProduceRequest = req.body;

  if (!analysisId || !filePath || !hook) {
    res.status(400).json({ error: 'Missing required fields: analysisId, filePath, hook' }); return;
  }

  if (!source && !segmentUrl) {
    res.status(400).json({ error: 'Must provide either source+sourceId or segmentUrl' }); return;
  }

  const jobId = uuidv4();
  const tmpDir = `/tmp/job-${jobId}`;
  fs.mkdirSync(tmpDir, { recursive: true });
  console.log(`[${jobId}] Starting — analysisId: ${analysisId}, source: ${source}/${sourceId} @ ${startTime}s-${endTime}s`);

  try {
    // Resolve download URL
    let downloadUrl: string;
    if (source && sourceId) {
      downloadUrl = await resolveDownloadUrl(source, sourceId, pexelsApiKey);
      console.log(`[${jobId}] Resolved download URL: ${downloadUrl}`);
    } else {
      downloadUrl = segmentUrl!;
      console.log(`[${jobId}] Using legacy segmentUrl`);
    }

    // Download full raw clip
    const rawVideoPath = path.join(tmpDir, 'raw.mp4');
    await downloadFile(downloadUrl, rawVideoPath);
    console.log(`[${jobId}] Downloaded raw clip`);

    // Trim to segment times + process
    const processedPath = path.join(tmpDir, 'processed.mp4');
    await runFFmpeg({
      jobId,
      inputPath: rawVideoPath,
      outputPath: processedPath,
      hook,
      addHookOverlay,
      startTime,
      duration: endTime - startTime,
    });

    // Extract thumbnail
    const thumbPath = path.join(tmpDir, 'thumb.jpg');
    await extractThumbnail(processedPath, thumbPath);

    // Upload to Supabase storage
    const videoBuffer = fs.readFileSync(processedPath);
    const { error: ve } = await supabase.storage
      .from('final_videos')
      .upload(filePath, videoBuffer, { contentType: 'video/mp4', upsert: true });
    if (ve) throw new Error(`Video upload failed: ${ve.message}`);

    const thumbStoragePath = filePath.replace(/\.mp4$/, '_thumb.jpg');
    const { error: te } = await supabase.storage
      .from('final_videos')
      .upload(thumbStoragePath, fs.readFileSync(thumbPath), { contentType: 'image/jpeg', upsert: true });
    if (te) throw new Error(`Thumb upload failed: ${te.message}`);

    const { data: { publicUrl: videoUrl } } = supabase.storage.from('final_videos').getPublicUrl(filePath);
    const { data: { publicUrl: thumbnailUrl } } = supabase.storage.from('final_videos').getPublicUrl(thumbStoragePath);

    console.log(`[${jobId}] Done ✓`);
    res.json({ videoUrl, thumbnailUrl });

  } catch (err: any) {
    console.error(`[${jobId}] Error:`, err.message);
    res.status(500).json({ error: err.message });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

interface FFmpegOpts {
  jobId: string;
  inputPath: string;
  outputPath: string;
  hook: string;
  addHookOverlay: boolean;
  startTime: number;
  duration: number;
}

function runFFmpeg({ inputPath, outputPath, hook, addHookOverlay, jobId, startTime, duration }: FFmpegOpts): Promise<void> {
  return new Promise((resolve, reject) => {
    const safeHook = hook
      .replace(/'/g, '\u2019')
      .replace(/:/g, '\\:')
      .replace(/\[/g, '\\[')
      .replace(/\]/g, '\\]');

    const scaleAndCrop = 'scale=1080:-2,crop=1080:1920:0:(ih-1920)/2';
    const hookFilter = addHookOverlay
      ? `,drawbox=x=0:y=ih*0.08:w=iw:h=ih*0.18:color=black@0.55:t=fill,drawtext=text='${safeHook}':fontsize=58:fontcolor=white:x=(w-text_w)/2:y=h*0.10:shadowcolor=black@0.8:shadowx=2:shadowy=2`
      : '';

    ffmpeg(inputPath)
      .seekInput(startTime)          // Trim: start at startTime
      .duration(duration)            // Trim: only keep `duration` seconds
      .videoFilters(scaleAndCrop + hookFilter)
      .videoCodec('libx264')
      .outputOptions(['-preset fast', '-crf 23', '-pix_fmt yuv420p', '-movflags +faststart'])
      .audioCodec('aac')
      .audioBitrate('128k')
      .output(outputPath)
      .on('start', cmd => console.log(`[${jobId}] FFmpeg:`, cmd))
      .on('end', () => resolve())
      .on('error', err => reject(new Error(`FFmpeg failed: ${err.message}`)))
      .run();
  });
}

function extractThumbnail(videoPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .screenshots({
        timestamps: ['00:00:00.500'],
        filename: path.basename(outputPath),
        folder: path.dirname(outputPath),
        size: '1080x1920',
      })
      .on('end', () => resolve())
      .on('error', err => reject(new Error(`Thumbnail failed: ${err.message}`)));
  });
}

function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(dest);
    protocol.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        file.close();
        fs.unlink(dest, () => {});
        downloadFile(response.headers.location!, dest).then(resolve).catch(reject);
        return;
      }
      if (response.statusCode !== 200) {
        reject(new Error(`Download failed: ${response.statusCode} from ${url}`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => file.close(() => resolve()));
    }).on('error', err => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

const PORT = parseInt(process.env.PORT || '3001', 10);
app.listen(PORT, () => console.log(`Worker running on port ${PORT}`));
// Error handling
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

console.log('Worker process initialized');
