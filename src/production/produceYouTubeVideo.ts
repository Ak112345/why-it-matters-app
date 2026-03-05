/**
 * Send a long-form clip to the Railway worker for YouTube production
 */

import { ENV } from '../utils/env';
import { supabase } from '../utils/supabaseClient';
import { YouTubeAnalysis } from '../intelligence/youtubeAnalysisPrompt';

export interface YouTubeProduceResult {
  success: boolean;
  videoId?: string;
  error?: string;
  analysisId?: string;
}

export async function produceYouTubeVideo(
  sourceId: string,
  duration: number,
  analysis: YouTubeAnalysis,
  analysisId: string
): Promise<YouTubeProduceResult> {
  const workerUrl = ENV.RAILWAY_WORKER_URL || process.env.RAILWAY_WORKER_URL;
  const workerSecret = ENV.WORKER_SECRET || process.env.WORKER_SECRET;

  if (!workerUrl || !workerSecret) {
    return { success: false, error: 'Missing RAILWAY_WORKER_URL or WORKER_SECRET', analysisId };
  }

  try {
    console.log(`[produceYouTube] Sending to worker: ${sourceId} (${duration}s)`);

    const res = await fetch(`${workerUrl}/produce-youtube`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-worker-secret': workerSecret,
      },
      body: JSON.stringify({
        analysisId,
        sourceId,
        startTime: 0,
        endTime: duration,
        hook: analysis.hook,
        caption: analysis.description,
        explanation: analysis.explanation,
        contentPillar: analysis.contentPillar,
        viralityScore: analysis.viralityScore,
        captions: [],
      }),
    });

    const data: any = await res.json();

    if (!res.ok || !data.success) {
      return {
        success: false,
        error: data.error || `Worker error ${res.status}`,
        analysisId,
      };
    }

    console.log(`[produceYouTube] Worker accepted job: videoId=${data.videoId}`);
    return { success: true, videoId: data.videoId, analysisId };
  } catch (err: any) {
    console.error('[produceYouTube] Failed:', err.message);
    return { success: false, error: err.message, analysisId };
  }
}

export async function saveYouTubeAnalysis(
  sourceId: string,
  duration: number,
  topic: string,
  query: string,
  analysis: YouTubeAnalysis
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('youtube_analysis')
      .insert({
        source_id: sourceId,
        duration_seconds: duration,
        topic,
        query,
        hook: analysis.hook,
        description: analysis.description,
        explanation: analysis.explanation,
        content_pillar: analysis.contentPillar,
        virality_score: analysis.viralityScore,
        tags: analysis.tags,
        status: 'ready',
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error || !data) {
      console.error('[produceYouTube] Failed to save analysis:', error?.message);
      return null;
    }

    return data.id;
  } catch (err: any) {
    console.error('[produceYouTube] saveYouTubeAnalysis error:', err.message);
    return null;
  }
}