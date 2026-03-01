import { supabase } from '../utils/supabaseClient';

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
    // Try to get recent real analyses (not "Check this out" placeholders)
    console.log('[produceVideo] Fetching recent analyses...');
    
    // Approach 1: Try with ordering
    let recentAnalyses = null;
    let recentError = null;
    
    try {
      const result = await supabase
        .from('analysis')
        .select('id, hook')
        .order('analyzed_at', { ascending: false })
        .limit(batchSize * 5);
      recentAnalyses = result.data;
      recentError = result.error;
    } catch (e) {
      console.warn('[produceVideo] Ordered query failed, trying without ordering:', e);
    }

    // Fallback: Simple query without ordering
    if (!recentAnalyses || recentAnalyses.length === 0) {
      console.log('[produceVideo] Trying simple query without ordering...');
      const result = await supabase
        .from('analysis')
        .select('id, hook')
        .limit(batchSize * 10);
      recentAnalyses = result.data;
      recentError = result.error;
    }

    if (recentError || !recentAnalyses) {
      console.error('[produceVideo] Analysis fetch error:', recentError);
      throw new Error(`Failed to fetch analyses: ${recentError?.message || 'Unknown error'}`);
    }

    console.log(`[produceVideo] Fetched ${recentAnalyses.length} analyses`);

    // Filter to real analyses (not "Check this out" and not null)
    const realAnalyses = (recentAnalyses || [])
      .filter((row: any) => row.hook && row.hook !== 'Check this out');
    
    let candidateIds = realAnalyses.map((row: any) => row.id);
    console.log(`[produceVideo] Found ${candidateIds.length} real analyses out of ${recentAnalyses.length}`);

    // Fallback: if no real analyses, use all analyses
    if (candidateIds.length === 0) {
      candidateIds = (recentAnalyses || []).map((row: any) => row.id);
      console.log(`[produceVideo] Using all ${candidateIds.length} analyses as fallback`);
    }

    if (candidateIds.length === 0) throw new Error('No analyses available to produce videos');

    // Try to filter by already produced, but don't fail if this query fails
    let alreadyProduced = new Set<string>();
    try {
      console.log(`[produceVideo] Checking ${candidateIds.length} analyses against videos_final...`);
      const { data: existingVideos, error: videoCheckError } = await supabase
        .from('videos_final')
        .select('analysis_id')
        .in('analysis_id', candidateIds.slice(0, 100)); // Check in batches if needed

      if (!videoCheckError) {
        alreadyProduced = new Set((existingVideos || []).map((row: any) => row.analysis_id));
        console.log(`[produceVideo] ${alreadyProduced.size} analyses already have videos`);
      } else {
        console.warn('[produceVideo] Failed to check existing videos, proceeding without filter:', videoCheckError.message);
      }
    } catch (err) {
      console.warn('[produceVideo] Exception checking videos, proceeding without filter:', err);
    }

    targetAnalysisIds = candidateIds.filter((id) => !alreadyProduced.has(id)).slice(0, batchSize);
    console.log(`[produceVideo] Selected ${targetAnalysisIds.length} unproduced analyses to process`);

    if (targetAnalysisIds.length === 0) {
      console.warn('[produceVideo] No unproduced analyses found', {
        totalCandidates: candidateIds.length,
        alreadyProducedCount: alreadyProduced.size,
        batchSize,
      });
      throw new Error('No unproduced analyses found to process');
    }
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