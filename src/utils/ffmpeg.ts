/**
 * FFmpeg helper functions for video processing
 * Handles segmentation, cropping, overlays, and subtitle generation
 */

import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import { promises as fsPromises } from 'fs';
import path from 'path';

// Use system FFmpeg (better for dev containers)
const ffmpegPath = process.env.FFMPEG_PATH || '/usr/bin/ffmpeg';
if (fs.existsSync(ffmpegPath)) {
  ffmpeg.setFfmpegPath(ffmpegPath);
  console.log(`Using FFmpeg at: ${ffmpegPath}`);
} else {
  console.warn(`FFmpeg not found at ${ffmpegPath}, using default`);
}

export function segmentVideo(
  inputPath: string,
  outputDir: string,
  segmentDurationSeconds: number = 10
): Promise<string[]> {
  return new Promise(async (resolve, reject) => {
    try {
      await fsPromises.mkdir(outputDir, { recursive: true });
      const outputPattern = path.join(outputDir, 'segment-%03d.mp4');

      ffmpeg(inputPath)
        .outputOptions([
          '-c copy',
          `-segment_time ${segmentDurationSeconds}`,
          '-f segment',
          '-reset_timestamps 1',
        ])
        .output(outputPattern)
        .on('end', () => {
          const files: string[] = [];
          const max = 500;

          for (let i = 0; i < max; i += 1) {
            const file = path.join(outputDir, `segment-${String(i).padStart(3, '0')}.mp4`);
            if (fs.existsSync(file)) {
              files.push(file);
            }
          }

          resolve(files);
        })
        .on('error', (err) => {
          reject(err);
        })
        .run();
    } catch (error) {
      reject(error);
    }
  });
}

export function cropToVertical(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .videoFilters('crop=in_h*9/16:in_h')
      .outputOptions(['-c:a copy'])
      .save(outputPath)
      .on('end', () => resolve())
      .on('error', (err) => reject(err));
  });
}

export interface ProduceVideoOptions {
  inputPath: string;
  outputPath: string;
  crop?: boolean;
  overlayText?: string;
  subtitlePath?: string;
}

export async function produceVideo(options: ProduceVideoOptions): Promise<void> {
  const { inputPath, outputPath, crop = true, overlayText, subtitlePath } = options;

  const outputDir = path.dirname(outputPath);
  await fsPromises.mkdir(outputDir, { recursive: true });

  return new Promise((resolve, reject) => {
    let command = ffmpeg(inputPath);
    const filters: string[] = [];

    if (crop) {
      filters.push('scale=1080:1920:force_original_aspect_ratio=increase');
      filters.push('crop=1080:1920');
    }

    if (subtitlePath) {
      filters.push(`subtitles=${subtitlePath}`);
    }

    if (overlayText) {
      const textFilter = `drawtext=text='${overlayText.replace(/'/g, "\\'")}':fontsize=48:fontcolor=white:x=(w-text_w)/2:y=h-100:box=1:boxcolor=black@0.5:boxborderw=5`;
      filters.push(textFilter);
    }

    if (filters.length > 0) {
      command = command.videoFilters(filters);
    }

    command
      .output(outputPath)
      .audioCodec('aac')
      .videoCodec('libx264')
      .on('start', (cmd) => {
        console.log('[FFmpeg] Starting command:', cmd);
      })
      .on('progress', (progress) => {
        console.log(`[FFmpeg] Progress: ${progress.percent}%`);
      })
      .on('end', () => {
        console.log(`[FFmpeg] Video production complete: ${outputPath}`);
        resolve();
      })
      .on('error', (err) => {
        console.error('[FFmpeg] Error during video production:', err);
        reject(err);
      })
      .run();
  });
}

export async function extractAudio(videoPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .output(outputPath)
      .noVideo()
      .audioCodec('libmp3lame')
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .run();
  });
}

export async function generateThumbnail(
  videoPath: string,
  outputPath: string,
  timestamp: string = '00:00:01'
): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .screenshots({
        timestamps: [timestamp],
        filename: path.basename(outputPath),
        folder: path.dirname(outputPath),
        size: '1080x1920',
      })
      .on('end', () => resolve())
      .on('error', (err) => reject(err));
  });
}
