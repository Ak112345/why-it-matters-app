/**
 * Produce final videos with cropping, overlays, and subtitles
 */

import { supabase } from '../utils/supabaseClient';
import { downloadFile, uploadFile, generateFilePath } from '../utils/storage';
import { produceVideo as produceVideoFFmpeg, generateThumbnail } from '../utils/ffmpeg';
import { generateSubtitles } from './generateSubtitles';
import { writeFile, mkdir, rm } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import os from 'os';

export interface ProduceVideoOptions {
  analysisId?: string; // If provided, produce only this video
  analysisIds?: string[]; // If provided, produce videos for these analyses
  batchSize?: number; // Number of videos to produce at once
  addSubtitles?: boolean; // Whether to add subtitles
  addHookOverlay?: boolean; // Whether to add hook text overlay
}

export interface ProduceResult {
  analysisId: string;
  videoId: string;
  filePath: string;
}

/**
 * Produce a single final video
 */
async function produceSingleVideo(
  analysisId: string,
  addSubtitles: boolean = true,
  addHookOverlay: boolean = true
): Promise<ProduceResult> {
  try {
    // Check if already produced
    const { data: existingVideo } = await supabase
      .from('videos_final')
      .select('id, file_path')
      .eq('analysis_id', analysisId)
      .single();

    if (existingVideo) {
      console.log(`Video for analysis ${analysisId} already produced, skipping`);
      return {
        analysisId,
        videoId: existingVideo.id,
        filePath: existingVideo.file_path,
      };
    }

    // Fetch analysis with segment data
    const { data: analysis, error: fetchError } = await supabase
      .from('analysis')
      .select('*')
      .eq('id', analysisId)
      .single();

    if (fetchError || !analysis) {
      throw new Error(`Analysis not found: ${analysisId}`);
    }

    // Fetch segment separately
    const { data: segment, error: segmentError } = await supabase
      .from('clips_segmented')
      .select('*')
      .eq('id', (analysis as any).segment_id)
      .single();

    if (segmentError || !segment) {
      throw new Error(`Segment not found for analysis ${analysisId}`);
    }

    console.log(`Producing video for analysis ${analysisId}...`);

      if (!segment.file_path) {
        throw new Error(`Segment file_path is null for analysis ${analysisId}`);
      }
    // Log segment file path for debugging
    console.log(`[DEBUG] segment.file_path: ${segment.file_path}`);
    // Download segment from storage using segment.file_path as the object name
    const blob = await downloadFile('segmented_clips', segment.file_path);
    const arrayBuffer = await blob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Save to temp location
    const tempDir = path.join(os.tmpdir(), 'viral-clips-production', analysisId);
    await mkdir(tempDir, { recursive: true });
    const inputPath = path.join(tempDir, 'input.mp4');
    await writeFile(inputPath, buffer);

    const outputPath = path.join(tempDir, 'output.mp4');
    const thumbnailPath = path.join(tempDir, 'thumbnail.jpg');

    // Generate subtitles if requested
    let subtitlePath: string | undefined;
    if (addSubtitles) {
      try {
        subtitlePath = await generateSubtitles(inputPath, analysis.explanation || undefined);
        console.log('Subtitles generated');
      } catch (error) {
        console.error('Failed to generate subtitles:', error);
      }
    }

    // Produce final video
    await produceVideoFFmpeg({
      inputPath,
      outputPath,
      crop: true, // Always crop to 9:16
      overlayText: addHookOverlay ? (analysis.hook || undefined) : undefined,
      subtitlePath,
    });

    console.log('Video produced, verifying file exists...');
    
    // Verify output file exists
    if (!existsSync(outputPath)) {
      throw new Error(`Output video file was not created: ${outputPath}`);
    }

    console.log('Video file verified, generating thumbnail...');

    // Generate thumbnail
    try {
      await generateThumbnail(outputPath, thumbnailPath);
    } catch (error) {
      console.error('Failed to generate thumbnail:', error);
    }

    // Upload final video to storage
    const videoStoragePath = generateFilePath('final', 'mp4');
    await uploadFile('final_videos', videoStoragePath, outputPath);

    // Upload thumbnail if it exists
    let thumbnailStoragePath: string | undefined;
    try {
      thumbnailStoragePath = generateFilePath('thumbnails', 'jpg');
      await uploadFile('final_videos', thumbnailStoragePath, thumbnailPath);
    } catch (error) {
      console.error('Failed to upload thumbnail:', error);
    }

    // Get video duration
    const duration = segment.duration_seconds;

    // Insert into database
    const { data: insertedVideo, error: insertError } = await supabase
      .from('videos_final')
      .insert({
        segment_id: segment.id,
        analysis_id: analysisId,
        file_path: videoStoragePath,
        thumbnail_path: thumbnailStoragePath,
        duration_seconds: duration,
        has_subtitles: addSubtitles && !!subtitlePath,
        produced_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    // Clean up temp files
    await rm(tempDir, { recursive: true, force: true });

    console.log(`Successfully produced video ${insertedVideo.id}`);

    return {
      analysisId,
      videoId: insertedVideo.id,
      filePath: videoStoragePath,
    };
  } catch (error) {
    console.error(`Error producing video for analysis ${analysisId}:`, error);
    throw error;
  }
}

/**
 * Produce final videos
 */
export async function produceVideo(options: ProduceVideoOptions = {}): Promise<ProduceResult[]> {
  const {
    analysisId,
    analysisIds,
    batchSize = 5,
    addSubtitles = true,
    addHookOverlay = true,
  } = options;

  const results: ProduceResult[] = [];

  try {
    // If specific analysis ID provided, produce only that video
    if (analysisId) {
      const result = await produceSingleVideo(analysisId, addSubtitles, addHookOverlay);
      results.push(result);
      return results;
    }

    // If specific analysis IDs provided, produce videos for those
    if (analysisIds && analysisIds.length > 0) {
      console.log(`[DEBUG] Producing videos for ${analysisIds.length} analyses`);
      
      // Fetch and sort analyses by virality score to produce the best ones first
      const { data: analyses, error: sortError } = await supabase
        .from('analysis')
        .select('id, virality_score')
        .in('id', analysisIds)
        .order('virality_score', { ascending: false });
      
      if (sortError) {
        console.warn('Failed to sort analyses by virality, using original order');
      }
      
      const sortedIds = analyses && analyses.length > 0
        ? analyses.map(a => a.id)
        : analysisIds;
      
      const idsToProcess = sortedIds.slice(0, batchSize);
      console.log(`[DEBUG] Selected top ${idsToProcess.length} analyses by virality score`);
      
      for (const aId of idsToProcess) {
        try {
          const result = await produceSingleVideo(aId, addSubtitles, addHookOverlay);
          results.push(result);
        } catch (error) {
          console.error(`Failed to produce video for analysis ${aId}:`, error);
          // Continue with next analysis
        }
      }
      
      return results;
    }

    // Otherwise, produce videos for all analyses that haven't been produced yet
    // Prioritize high virality scores
    const { data: analyses, error: fetchError } = await supabase
      .from('analysis')
      .select('id')
      .order('virality_score', { ascending: false })
      .limit(batchSize);

    if (fetchError) {
      throw fetchError;
    }

    if (!analyses || analyses.length === 0) {
      console.log('No analyses found to produce videos for');
      return results;
    }

    console.log(`Found ${analyses.length} analyses to check for production`);

    for (const analysis of analyses) {
      try {
        const result = await produceSingleVideo(analysis.id, addSubtitles, addHookOverlay);
        results.push(result);
      } catch (error) {
        console.error(`Failed to produce video for analysis ${analysis.id}:`, error);
      }
    }

    console.log(`Production complete: ${results.length} videos produced`);
    return results;
  } catch (error) {
    console.error('Error during video production:', error);
    throw error;
  }
}
