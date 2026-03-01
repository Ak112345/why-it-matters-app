import { createClient } from "@supabase/supabase-js";

// Use fresh instance to avoid any context/caching issues
const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || ""
);

interface ProduceVideoOptions {
  analysisIds?: string[];
  analysisId?: string;
  batchSize?: number;
  addSubtitles?: boolean;
  addHookOverlay?: boolean;
}

interface ProducedVideo {
  analysisId: string;
  videoUrl: string;
  thumbnailUrl: string;
}

export async function produceVideo({
  analysisId,
  analysisIds,
  batchSize = 4,
  addSubtitles = true,
  addHookOverlay = true,
}: ProduceVideoOptions): Promise<ProducedVideo[]> {
  const workerUrl = process.env.RAILWAY_WORKER_URL;
  const workerSecret = process.env.WORKER_SECRET;

  if (!workerUrl) throw new Error('RAILWAY_WORKER_URL env var is not set');
  if (!workerSecret) throw new Error('WORKER_SECRET env var is not set');

  let targetAnalysisIds: string[] = [];
  if (analysisId) {
    targetAnalysisIds = [analysisId];
  } else if (analysisIds && analysisIds.length > 0) {
    targetAnalysisIds = analysisIds.slice(0, batchSize);
  } else {
    // Get analyses to produce - simplest possible approach
    console.log('[produceVideo] Fetching analyses for production...');
    
    const { data: analyses, error: analysisError } = await supabase
      .from('analysis')
      .select('id, hook')
      .limit(batchSize * 10);

    if (analysisError || !analyses) {
      console.error('[produceVideo] Failed to fetch analyses:', analysisError);
      throw new Error(`Failed to fetch analyses: ${analysisError?.message || 'Unknown'}`);
    }

    if (analyses.length === 0) {
      throw new Error('No analyses available to produce videos');
    }

    console.log(`[produceVideo] Fetched ${analyses.length} analyses`);

    // Get only real (non-placeholder) analyses
    const realAnalyses = analyses
      .filter((row: any) => row.hook && row.hook !== 'Check this out')
      .slice(0, batchSize);
    
    if (realAnalyses.length === 0) {
      throw new Error('No real analyses available (all are placeholders)');
    }

    console.log(`[produceVideo] Selected ${realAnalyses.length} real analyses to produce`);
    targetAnalysisIds = realAnalyses.map((row: any) => row.id);
  }

  const { data: analyses, error } = await supabase
    .from('analysis')
    .select('id, segment_id, hook, caption, explanation')
    .in('id', targetAnalysisIds)
    .limit(batchSize);

  if (error) throw new Error(`Failed to fetch analyses: ${error.message}`);
  if (!analyses || analyses.length === 0) throw new Error('No analyses found for given IDs');

  const segmentIds = analyses.map((analysis: any) => analysis.segment_id).filter(Boolean);
  const { data: segments, error: segmentsError } = await supabase
    .from('clips_segmented')
    .select('id, file_path, start_time, end_time, raw_clip_id')
    .in('id', segmentIds);

  if (segmentsError) throw new Error(`Failed to fetch segments: ${segmentsError.message}`);

  const segmentsById = new Map((segments || []).map((segment: any) => [segment.id, segment]));
  const rawClipIds = Array.from(
    new Set((segments || []).map((segment: any) => segment.raw_clip_id).filter(Boolean))
  );

  const { data: rawClips, error: rawClipsError } = await supabase
    .from('clips_raw')
    .select('id, source, source_id')
    .in('id', rawClipIds);

  if (rawClipsError) throw new Error(`Failed to fetch raw clips: ${rawClipsError.message}`);

  const rawClipsById = new Map((rawClips || []).map((rawClip: any) => [rawClip.id, rawClip]));

  const results: ProducedVideo[] = [];

  for (const analysis of analyses) {
    const segment = segmentsById.get((analysis as any).segment_id) as any;
    const rawClip = segment ? rawClipsById.get(segment.raw_clip_id) as any : null;

    if (!segment || !rawClip) {
      console.warn(`[produceVideo] Missing segment or raw clip for analysis ${analysis.id}, skipping`);
      continue;
    }

    const { source, source_id } = rawClip;
    const startTime = segment.start_time ?? 0;
    const endTime = segment.end_time ?? 10;
    const outputFilePath = `outputs/${analysis.id}.mp4`;

    try {
      console.log(`[produceVideo] Sending job to Railway for analysis ${analysis.id} (${source}/${source_id} ${startTime}s-${endTime}s)`);

      const response = await fetch(`${workerUrl}/produce`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-worker-secret': workerSecret,
        },
        body: JSON.stringify({
          analysisId: analysis.id,
          // Source info for direct download — no more broken storage URLs
          source,
          sourceId: source_id,
          startTime,
          endTime,
          // Pexels API key passed through so worker can resolve download URL
          pexelsApiKey: process.env.PEXELS_API_KEY,
          filePath: outputFilePath,
          hook: analysis.hook ?? 'Watch this.',
          caption: analysis.caption ?? '',
          explanation: analysis.explanation ?? '',
          addSubtitles,
          addHookOverlay,
        }),
      });

      if (!response.ok) {
        const err = await response.json() as { error?: string };
        throw new Error(`Worker error: ${err.error ?? response.status}`);
      }

      const { videoUrl, thumbnailUrl } = await response.json() as {
        videoUrl: string;
        thumbnailUrl: string;
      };

      await supabase.from('videos_final').insert({
        segment_id: segment.id,
        analysis_id: analysis.id,
        file_path: videoUrl,
        thumbnail_path: thumbnailUrl,
        has_subtitles: addSubtitles,
        status: 'drafted',
        produced_at: new Date().toISOString(),
        production_settings: { addSubtitles, addHookOverlay, workerUrl },
      });

      results.push({ analysisId: analysis.id, videoUrl, thumbnailUrl });
      console.log(`[produceVideo] ✓ Done: ${analysis.id}`);

    } catch (err: any) {
      console.error(`[produceVideo] ✗ Failed for ${analysis.id}:`, err.message);
      await supabase.from('videos_final').insert({
        segment_id: segment.id,
        analysis_id: analysis.id,
        file_path: '',
        status: 'error',
        error_message: err.message,
      });
    }
  }

  return results;
}