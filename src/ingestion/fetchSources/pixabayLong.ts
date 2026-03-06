/**
 * Fetch long-form video clips from Pixabay (30–60s) for YouTube pipeline
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

export async function fetchPixabayLongClip(
  query: string,
  topic: string
): Promise<LongFormClip | null> {

  if (PAUSE_STOCK_FETCH) {
    console.log('[pixabayLong] Stock clip fetching paused');
    return null;
  }

  if (!ENV.PIXABAY_USERNAME) {
    console.warn('[pixabayLong] PIXABAY_USERNAME not set');
    return null;
  }
  
  try {
    const url = new URL('https://pixabay.com/api/videos/');
    url.searchParams.set('key', ENV.PIXABAY_USERNAME);
    url.searchParams.set('q', query);
    url.searchParams.set('per_page', '20');
    url.searchParams.set('video_type', 'film');
    url.searchParams.set('order', 'popular');

    const res = await fetch(url.toString());

    if (!res.ok) {
      console.warn(`[pixabayLong] API ${res.status} for query: "${query}"`);
      return null;
    }

    const data: any = await res.json();
    const hits: any[] = data.hits || [];

    // Filter to 30–60s, prefer closest to 45s
    const suitable = hits
      .filter(v => v.duration >= MIN_DURATION && v.duration <= MAX_DURATION)
      .sort((a, b) => Math.abs(a.duration - 45) - Math.abs(b.duration - 45));

    if (!suitable.length) {
      console.log(`[pixabayLong] No ${MIN_DURATION}–${MAX_DURATION}s clips for "${query}"`);
      return null;
    }

    const chosen = suitable[0];
    const videos = chosen.videos || {};
    const downloadUrl =
      videos.large?.url ||
      videos.medium?.url ||
      videos.small?.url ||
      videos.tiny?.url;

    if (!downloadUrl) return null;

    console.log(`[pixabayLong] Found: id=${chosen.id} duration=${chosen.duration}s query="${query}"`);

    return {
      sourceId: `pixabay_${chosen.id}`,
      downloadUrl,
      duration: chosen.duration,
      query,
      topic,
    };
  } catch (err: any) {
    console.error(`[pixabayLong] Error for "${query}":`, err.message);
    return null;
  }
}