/**
 * Segment raw clips into 5-15 second segments using FFmpeg
 */

import { supabase } from '../utils/supabaseClient';
import { segmentVideo } from '../utils/ffmpeg';
import { writeFile, mkdir, rm, readFile } from 'fs/promises';
import path from 'path';
import os from 'os';

export interface SegmentClipsOptions {
  rawClipId?: string;
  segmentDuration?: number;
  minDuration?: number;
  maxDuration?: number;
}

export interface SegmentResult {
  rawClipId: string;
  segmentCount: number;
  segmentIds: string[];
}

/**
 * Get a direct download URL for a clip based on source + source_id
 */
async function getDownloadUrl(source: string, sourceId: string): Promise<string | null> {
  if (source === 'pexels') {
    // sourceId is stored as "pexels_12345" or just "12345"
    const numericId = sourceId.replace(/^pexels_/, '');
    const apiKey = process.env.PEXELS_API_KEY;
    if (!apiKey) return null;

    const response = await fetch(`https://api.pexels.com/videos/videos/${numericId}`, {
      headers: { Authorization: apiKey },
    });
    if (!response.ok) return null;

    const data = await response.json();
    const hdFile = data.video_files?.find(
      (f: any) => f.quality === 'hd' && f.file_type === 'video/mp4'
    ) || data.video_files?.[0];

    return hdFile?.link ?? null;
  }

  // Internet Archive: construct direct download URL
  if (source === 'internet_archive') {
    const itemId = sourceId;
    // Try common video file extensions
    return `https://archive.org/download/${itemId}/${itemId}.mp4`;
  }

  return null;
}

/**
 * Segment a single raw clip
 */
async function segmentSingleClip(
  rawClipId: string,
  segmentDuration: number = 10
): Promise<SegmentResult> {
  const result: SegmentResult = {
    rawClipId,
    segmentCount: 0,
    segmentIds: [],
  };

  try {
    // Fetch raw clip from database
    const { data: rawClip, error: fetchError } = await supabase
      .from('clips_raw')
      .select('*')
      .eq('id', rawClipId)
      .single();

    if (fetchError || !rawClip) {
      throw new Error(`Raw clip not found: ${rawClipId}`);
    }

    console.log(`Segmenting clip: ${rawClip.source_id}`);

    // Save to temp location
    const tempDir = path.join(os.tmpdir(), 'viral-clips', rawClipId);
    await mkdir(tempDir, { recursive: true });
    const inputPath = path.join(tempDir, 'input.mp4');

    // --- Strategy 1: Try Supabase Storage ---
    let downloaded = false;
    if (rawClip.file_path) {
      // Strip bucket prefix if present (file_path may be "raw_clips/foo.mp4")
      const storagePath = rawClip.file_path.startsWith('raw_clips/')
        ? rawClip.file_path.slice('raw_clips/'.length)
        : rawClip.file_path;

      const { data: fileData, error: downloadError } = await supabase.storage
        .from('raw_clips')
        .download(storagePath);

      if (!downloadError && fileData) {
        const buffer = Buffer.from(await fileData.arrayBuffer());
        await writeFile(inputPath, buffer);
        downloaded = true;
        console.log(`Downloaded from storage: ${storagePath}`);
      } else {
        console.log(`Storage miss (${downloadError?.message ?? 'no data'}), trying source URL...`);
      }
    }

    // --- Strategy 2: Download directly from source ---
    if (!downloaded) {
      const downloadUrl = await getDownloadUrl(rawClip.source, rawClip.source_id);
      if (!downloadUrl) {
        throw new Error(`Cannot get download URL for ${rawClip.source}/${rawClip.source_id}`);
      }

      console.log(`Downloading from source: ${downloadUrl}`);
      const response = await fetch(downloadUrl);
      if (!response.ok) {
        throw new Error(`Source download failed: ${response.status} ${response.statusText}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      await writeFile(inputPath, buffer);
      downloaded = true;

      // Upload to storage for future use (fire and forget — don't block on this)
      const filename = rawClip.file_path
        ? (rawClip.file_path.startsWith('raw_clips/')
            ? rawClip.file_path.slice('raw_clips/'.length)
            : rawClip.file_path)
        : `${rawClip.source}-${rawClip.source_id}.mp4`;

      supabase.storage
        .from('raw_clips')
        .upload(filename, buffer, { upsert: true })
        .then(({ error }) => {
          if (error) console.warn(`Failed to cache to storage: ${error.message}`);
          else console.log(`Cached to storage: ${filename}`);
        });
    }

    // Create segments directory
    const segmentsDir = path.join(tempDir, 'segments');
    await mkdir(segmentsDir, { recursive: true });

    // Segment the video
    const segments = await segmentVideo(inputPath, segmentsDir, segmentDuration);
    console.log(`Created ${segments.length} segments for ${rawClip.source_id}`);

    // Insert each segment into database
    for (let i = 0; i < segments.length; i++) {
      const segmentPath = segments[i];
      const storagePath = `${rawClipId}/${path.basename(segmentPath)}`;

      const segmentBuffer = await readFile(segmentPath);
      await supabase.storage
        .from('segmented_clips')
        .upload(storagePath, segmentBuffer, { upsert: true });

      const { data: insertedSegment, error: insertError } = await supabase
        .from('clips_segmented')
        .insert({
          raw_clip_id: rawClipId,
          file_path: storagePath,
          start_time: i * segmentDuration,
          end_time: (i + 1) * segmentDuration,
          duration_seconds: segmentDuration,
          status: 'pending',
        })
        .select()
        .single();

      if (insertError) {
        console.warn(`Failed to insert segment ${i}: ${insertError.message}`);
        continue;
      }

      if (insertedSegment) {
        result.segmentCount++;
        result.segmentIds.push(insertedSegment.id);
      }
    }

    // Update raw clip status to segmented
    await supabase
      .from('clips_raw')
      .update({ status: 'segmented' })
      .eq('id', rawClipId);

    // Clean up temp files
    await rm(tempDir, { recursive: true, force: true });

    console.log(`Successfully segmented ${rawClip.source_id}: ${result.segmentCount} segments`);
    return result;

  } catch (error) {
    console.error(`Error segmenting clip ${rawClipId}:`, error);

    // Mark clip as errored so we don't retry forever
    await supabase
      .from('clips_raw')
      .update({ 
        status: 'error',
        error_message: error instanceof Error ? error.message : String(error),
      })
      .eq('id', rawClipId);

    throw error;
  }
}

/**
 * Segment raw clips
 */
export async function segmentClips(options: SegmentClipsOptions = {}): Promise<SegmentResult[]> {
  const { rawClipId, segmentDuration = 10 } = options;
  const results: SegmentResult[] = [];

  try {
    if (rawClipId) {
      const result = await segmentSingleClip(rawClipId, segmentDuration);
      results.push(result);
      return results;
    }

    // Only process clips with status 'pending' (not 'segmented' or 'error')
    const { data: rawClips, error: fetchError } = await supabase
      .from('clips_raw')
      .select('id')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(20); // Process max 20 per run to avoid Vercel timeout

    if (fetchError) throw fetchError;

    if (!rawClips || rawClips.length === 0) {
      console.log('No pending raw clips found to segment');
      return results;
    }

    console.log(`Found ${rawClips.length} raw clips to check for segmentation`);

    for (const clip of rawClips) {
      try {
        const { data: existingSegments } = await supabase
          .from('clips_segmented')
          .select('id')
          .eq('raw_clip_id', clip.id)
          .limit(1);

        if (existingSegments && existingSegments.length > 0) {
          // Already has segments, mark as segmented
          await supabase
            .from('clips_raw')
            .update({ status: 'segmented' })
            .eq('id', clip.id);
          continue;
        }

        const result = await segmentSingleClip(clip.id, segmentDuration);
        results.push(result);
      } catch (error) {
        console.error(`Failed to segment clip ${clip.id}:`, error);
        // Continue to next clip — error already recorded in DB
      }
    }

    console.log(`Segmentation complete: ${results.length} clips processed`);
    return results;

  } catch (error) {
    console.error('Error during segmentation:', error);
    throw error;
  }
}