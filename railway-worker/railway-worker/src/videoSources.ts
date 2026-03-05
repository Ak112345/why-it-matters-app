/**
 * videoSources.ts
 * YouTube long-form clip fetcher — Pexels + Pixabay
 *
 * Strategy:
 *   1. Try Pexels first (familiar API, already in use)
 *   2. Fall back to Pixabay if Pexels returns nothing suitable
 *
 * Target: 30–60s clips, highest quality available
 */

const PEXELS_API_KEY  = process.env.PEXELS_API_KEY  || '';
const PIXABAY_API_KEY = process.env.PIXABAY_API_KEY || '';

const MIN_DURATION = 30;
const MAX_DURATION = 60;

// ─── Evergreen Topic Map ──────────────────────────────────────────────────────

export const YOUTUBE_TOPIC_QUERIES: Record<string, string[]> = {
  'Society & Human Impact': [
    'city life', 'community', 'people working', 'urban development',
  ],
  'Technology & Future': [
    'technology', 'innovation', 'digital world', 'artificial intelligence',
  ],
  'Economy & Money': [
    'business', 'stock market', 'economy', 'financial district',
  ],
  'Environment & Earth': [
    'climate', 'nature', 'environment', 'ocean',
  ],
  'Power & Politics': [
    'government', 'protest', 'democracy', 'city hall',
  ],
  'Health & Science': [
    'medical research', 'hospital', 'science lab', 'public health',
  ],
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VideoClipResult {
  url: string;
  duration: number;
  source: 'pexels' | 'pixabay';
  sourceId: string;
  query: string;
  topic: string;
}

// ─── Pexels Fetcher ───────────────────────────────────────────────────────────

async function fetchFromPexels(
  query: string,
  topic: string
): Promise<VideoClipResult | null> {
  if (!PEXELS_API_KEY) {
    console.warn('[sources] PEXELS_API_KEY not set');
    return null;
  }

  try {
    const url = new URL('https://api.pexels.com/videos/search');
    url.searchParams.set('query', query);
    url.searchParams.set('per_page', '15');
    url.searchParams.set('orientation', 'landscape');
    url.searchParams.set('size', 'large');

    const res = await fetch(url.toString(), {
      headers: { Authorization: PEXELS_API_KEY },
    });

    if (!res.ok) {
      console.warn(`[sources] Pexels ${res.status} for query: ${query}`);
      return null;
    }

    const data: any = await res.json();
    const videos: any[] = data.videos || [];

    // Filter to 30–60s, prefer closer to 45s
    const suitable = videos
      .filter(v => v.duration >= MIN_DURATION && v.duration <= MAX_DURATION)
      .sort((a, b) => Math.abs(a.duration - 45) - Math.abs(b.duration - 45));

    if (!suitable.length) {
      console.log(`[sources] Pexels: no suitable clips for "${query}" (need ${MIN_DURATION}–${MAX_DURATION}s)`);
      return null;
    }

    const chosen = suitable[0];
    const files: any[] = chosen.video_files || [];

    // Pick best quality download URL
    const file =
      files.find(f => f.quality === 'hd') ||
      files.find(f => f.quality === 'sd') ||
      files[0];

    if (!file?.link) return null;

    console.log(`[sources] Pexels hit: id=${chosen.id} duration=${chosen.duration}s query="${query}"`);

    return {
      url: file.link,
      duration: chosen.duration,
      source: 'pexels',
      sourceId: String(chosen.id),
      query,
      topic,
    };
  } catch (err: any) {
    console.error(`[sources] Pexels error for "${query}":`, err.message);
    return null;
  }
}

// ─── Pixabay Fetcher ──────────────────────────────────────────────────────────

async function fetchFromPixabay(
  query: string,
  topic: string
): Promise<VideoClipResult | null> {
  if (!PIXABAY_API_KEY) {
    console.warn('[sources] PIXABAY_API_KEY not set');
    return null;
  }

  try {
    const url = new URL('https://pixabay.com/api/videos/');
    url.searchParams.set('key', PIXABAY_API_KEY);
    url.searchParams.set('q', query);
    url.searchParams.set('per_page', '15');
    url.searchParams.set('video_type', 'film');
    url.searchParams.set('order', 'popular');

    const res = await fetch(url.toString());

    if (!res.ok) {
      console.warn(`[sources] Pixabay ${res.status} for query: ${query}`);
      return null;
    }

    const data: any = await res.json();
    const hits: any[] = data.hits || [];

    // Filter to 30–60s, prefer closer to 45s
    const suitable = hits
      .filter(v => v.duration >= MIN_DURATION && v.duration <= MAX_DURATION)
      .sort((a, b) => Math.abs(a.duration - 45) - Math.abs(b.duration - 45));

    if (!suitable.length) {
      console.log(`[sources] Pixabay: no suitable clips for "${query}" (need ${MIN_DURATION}–${MAX_DURATION}s)`);
      return null;
    }

    const chosen = suitable[0];
    const videos = chosen.videos || {};

    // Pick best quality: large → medium → small → tiny
    const file =
      videos.large?.url ||
      videos.medium?.url ||
      videos.small?.url  ||
      videos.tiny?.url;

    if (!file) return null;

    console.log(`[sources] Pixabay hit: id=${chosen.id} duration=${chosen.duration}s query="${query}"`);

    return {
      url: file,
      duration: chosen.duration,
      source: 'pixabay',
      sourceId: String(chosen.id),
      query,
      topic,
    };
  } catch (err: any) {
    console.error(`[sources] Pixabay error for "${query}":`, err.message);
    return null;
  }
}

// ─── Combined Fetcher ─────────────────────────────────────────────────────────

/**
 * Fetch a suitable long-form clip for a given topic.
 * Tries all queries for the topic across Pexels then Pixabay.
 * Returns the first suitable result found.
 */
export async function fetchYouTubeSourceClip(
  topic: string
): Promise<VideoClipResult | null> {
  const queries = YOUTUBE_TOPIC_QUERIES[topic];

  if (!queries || queries.length === 0) {
    console.warn(`[sources] No queries defined for topic: ${topic}`);
    return null;
  }

  console.log(`[sources] Fetching YouTube clip for topic: "${topic}"`);

  // Try Pexels first across all queries for this topic
  for (const query of queries) {
    const result = await fetchFromPexels(query, topic);
    if (result) return result;
  }

  // Fall back to Pixabay across all queries
  for (const query of queries) {
    const result = await fetchFromPixabay(query, topic);
    if (result) return result;
  }

  console.warn(`[sources] No clip found for topic "${topic}" on either source`);
  return null;
}

/**
 * Fetch clips for all topics — useful for batch pre-fetching.
 * Returns a map of topic → result (null if nothing found).
 */
export async function fetchAllTopicClips(): Promise<Record<string, VideoClipResult | null>> {
  const results: Record<string, VideoClipResult | null> = {};

  for (const topic of Object.keys(YOUTUBE_TOPIC_QUERIES)) {
    results[topic] = await fetchYouTubeSourceClip(topic);
  }

  return results;
}