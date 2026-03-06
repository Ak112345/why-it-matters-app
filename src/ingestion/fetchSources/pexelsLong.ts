/**
 * Fetch long-form video clips from Pexels (30–60s) for YouTube pipeline
 */

import { ENV } from '../../utils/env';
const PAUSE_STOCK_FETCH = true; //strage over crowded with too many videos, pause for now
const MIN_DURATION = 30;
const MAX_DURATION = 60;

export interface LongFormClip {
  sourceId: string;
  downloadUrl: string;
  duration: number;
  query: string;
  topic: string;
}

export async function fetchPexelsLongClip(
  query: string,
  topic: string
): Promise<LongFormClip | null> {

  if (PAUSE_STOCK_FETCH) {
    console.log('[pexelsLong] Stock clip fetching paused');
    return null;
  }

  if (!ENV.PEXELS_API_KEY) {
    console.warn('[pexelsLong] PEXELS_API_KEY not set');
    return null;
  }

  try {
    const url = new URL('https://api.pexels.com/videos/search');
    url.searchParams.set('query', query);
    url.searchParams.set('per_page', '20');
    url.searchParams.set('orientation', 'landscape');
    url.searchParams.set('size', 'large');

    const res = await fetch(url.toString(), {
      headers: { Authorization: ENV.PEXELS_API_KEY },
    });

    if (!res.ok) {
      console.warn(`[pexelsLong] API ${res.status} for query: "${query}"`);
      return null;
    }

    const data: any = await res.json();
    const videos: any[] = data.videos || [];

    // Filter to 30–60s, prefer closest to 45s
    const suitable = videos
      .filter(v => v.duration >= MIN_DURATION && v.duration <= MAX_DURATION)
      .sort((a, b) => Math.abs(a.duration - 45) - Math.abs(b.duration - 45));

    if (!suitable.length) {
      console.log(`[pexelsLong] No ${MIN_DURATION}–${MAX_DURATION}s clips for "${query}"`);
      return null;
    }

    const chosen = suitable[0];
    const files: any[] = chosen.video_files || [];
    const file =
      files.find(f => f.quality === 'hd' && f.file_type === 'video/mp4') ||
      files.find(f => f.quality === 'sd') ||
      files[0];

    if (!file?.link) return null;

    console.log(`[pexelsLong] Found: id=${chosen.id} duration=${chosen.duration}s query="${query}"`);

    return {
      sourceId: `pexels_${chosen.id}`,
      downloadUrl: file.link,
      duration: chosen.duration,
      query,
      topic,
    };
  } catch (err: any) {
    console.error(`[pexelsLong] Error for "${query}":`, err.message);
    return null;
  }
}