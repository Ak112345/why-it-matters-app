/**
 * Segment raw clips into 5-15 second segments using FFmpeg
 */

import { supabase } from '../utils/supabaseClient';
import { segmentVideo } from '../utils/ffmpeg';
import { writeFile, mkdir, rm, readFile } from 'fs/promises';
import path from 'path';
import os from 'os';

export interface SegmentClipsOptions {
  rawClipId?: string; // If provided, segment only this clip
  segmentDuration?: number; // Default: 10 seconds
  minDuration?: number; // Default: 5 seconds
  maxDuration?: number; // Default: 15 seconds
}

export interface SegmentResult {
  rawClipId: string;
  segmentCount: number;
  segmentIds: string[];
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

    if (!rawClip.file_path) {
      throw new Error(`Raw clip has no file_path: ${rawClipId}`);
    }

    console.log(`Segmenting clip: ${rawClip.source_id}`);

    // Download raw clip from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('raw_clips')
      .download(rawClip.file_path);

    if (downloadError || !fileData) {
      throw new Error(`Failed to download clip: ${downloadError?.message}`);
    }

    // Save to temp location
    const tempDir = path.join(os.tmpdir(), 'viral-clips', rawClipId);
    await mkdir(tempDir, { recursive: true });
    const inputPath = path.join(tempDir, 'input.mp4');
    const buffer = Buffer.from(await fileData.arrayBuffer());
    await writeFile(inputPath, buffer);

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

      // Upload segment to storage
      const segmentBuffer = await readFile(segmentPath);
      await supabase.storage
        .from('segmented_clips')
        .upload(storagePath, segmentBuffer, { upsert: true });

      // Insert into database
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

    // Clean up temp files
    await rm(tempDir, { recursive: true, force: true });

    console.log(`Successfully segmented ${rawClip.source_id}: ${result.segmentCount} segments`);
    return result;
  } catch (error) {
    console.error(`Error segmenting clip ${rawClipId}:`, error);
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
    // If specific clip ID provided, segment only that clip
    if (rawClipId) {
      const result = await segmentSingleClip(rawClipId, segmentDuration);
      results.push(result);
      return results;
    }

    // Otherwise, segment all raw clips that haven't been segmented yet
    const { data: rawClips, error: fetchError } = await supabase
      .from('clips_raw')
      .select('id')
      .order('created_at', { ascending: true });

    if (fetchError) {
      throw fetchError;
    }

    if (!rawClips || rawClips.length === 0) {
      console.log('No raw clips found to segment');
      return results;
    }

    console.log(`Found ${rawClips.length} raw clips to check for segmentation`);

    for (const clip of rawClips) {
      try {
        // Check if already segmented
        const { data: existingSegments } = await supabase
          .from('clips_segmented')
          .select('id')
          .eq('raw_clip_id', clip.id)
          .limit(1);

        if (existingSegments && existingSegments.length > 0) {
          console.log(`Clip ${clip.id} already segmented, skipping`);
          continue;
        }

        const result = await segmentSingleClip(clip.id, segmentDuration);
        results.push(result);
      } catch (error) {
        console.error(`Failed to segment clip ${clip.id}:`, error);
      }
    }

    console.log(`Segmentation complete: ${results.length} clips processed`);
    return results;
  } catch (error) {
    console.error('Error during segmentation:', error);
    throw error;
  }
}
