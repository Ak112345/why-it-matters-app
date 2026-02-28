import { supabase } from '../utils/supabaseClient';

interface ProduceVideoOptions {
  analysisIds: string[];
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
  analysisIds,
  batchSize = 4,
  addSubtitles = true,
  addHookOverlay = true,
}: ProduceVideoOptions): Promise<ProducedVideo[]> {
  const workerUrl = process.env.RAILWAY_WORKER_URL;
  const workerSecret = process.env.WORKER_SECRET;

  if (!workerUrl) throw new Error('RAILWAY_WORKER_URL env var is not set');
  if (!workerSecret) throw new Error('WORKER_SECRET env var is not set');

  // Join all the way up to raw clip to get source info
  const { data: analyses, error } = await supabase
    .from('analysis')
    .select(`
      id, segment_id, hook, caption, explanation,
      clips_segmented (
        id, file_path, start_time, end_time,
        clips_raw ( id, source, source_id )
      )
    `)
    .in('id', analysisIds)
    .limit(batchSize);

  if (error) throw new Error(`Failed to fetch analyses: ${error.message}`);
  if (!analyses || analyses.length === 0) throw new Error('No analyses found for given IDs');

  const results: ProducedVideo[] = [];

  for (const analysis of analyses) {
    const segment = analysis.clips_segmented as any;
    const rawClip = segment?.clips_raw as any;

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