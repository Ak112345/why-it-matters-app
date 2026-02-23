/**
 * Fetch video clips from Pixabay API
 */

import { ENV } from '../../utils/env.ts';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const cache = new Map<string, { expiresAt: number; data: PixabayResponse }>();

function getCached(url: string): PixabayResponse | null {
  const entry = cache.get(url);
  if (!entry) {
    return null;
  }

  if (entry.expiresAt < Date.now()) {
    cache.delete(url);
    return null;
  }

  return entry.data;
}

function setCached(url: string, data: PixabayResponse): void {
  cache.set(url, { expiresAt: Date.now() + CACHE_TTL_MS, data });
}

export interface PixabayVideo {
  id: number;
  pageURL: string;
  type: string;
  tags: string;
  duration: number;
  videos: {
    large?: { url: string; width: number; height: number; size: number };
    medium?: { url: string; width: number; height: number; size: number };
    small?: { url: string; width: number; height: number; size: number };
  };
}

export interface PixabayResponse {
  total: number;
  totalHits: number;
  hits: PixabayVideo[];
}

export interface FetchedClip {
  sourceId: string;
  sourceUrl: string;
  downloadUrl: string;
  duration: number;
  metadata: Record<string, any>;
}

export interface SourceClip {
  source: 'pixabay';
  source_id: string;
  download_url: string;
  duration?: number;
}

/**
 * Fetch videos from Pixabay
 * @param query - Search query (e.g., "nature", "technology")
 * @param perPage - Number of videos to fetch (max 200)
 * @param page - Page number
 */
export async function fetchPixabayVideos(
  query: string = 'nature',
  perPage: number = 10,
  page: number = 1
): Promise<FetchedClip[]> {
  try {
    if (!ENV.PIXABAY_USERNAME) {
      throw new Error('PIXABAY_USERNAME is not set');
    }
    const url = `https://pixabay.com/api/videos/?key=${ENV.PIXABAY_USERNAME}&q=${encodeURIComponent(query)}&per_page=${perPage}&page=${page}`;

    const cached = getCached(url);
    if (cached) {
      return cached.hits.map((video) => mapVideoToClip(video));
    }

    const response = await fetch(url);

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('Pixabay API rate limit exceeded');
      }
      throw new Error(`Pixabay API error: ${response.statusText}`);
    }

    const data: PixabayResponse = await response.json();

    setCached(url, data);

    // Convert Pixabay videos to our standard format
    return data.hits.map((video) => mapVideoToClip(video));
  } catch (error) {
    console.error('Error fetching Pixabay videos:', error);
    throw error;
  }
}

/**
 * Fetch popular/latest videos from Pixabay
 */
export async function fetchPopularPixabayVideos(
  perPage: number = 10,
  page: number = 1,
  order: 'popular' | 'latest' = 'popular'
): Promise<FetchedClip[]> {
  try {
    if (!ENV.PIXABAY_USERNAME) {
      throw new Error('PIXABAY_USERNAME is not set');
    }
    const url = `https://pixabay.com/api/videos/?key=${ENV.PIXABAY_USERNAME}&order=${order}&per_page=${perPage}&page=${page}`;

    const cached = getCached(url);
    if (cached) {
      return cached.hits.map((video) => mapVideoToClip(video));
    }

    const response = await fetch(url);

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('Pixabay API rate limit exceeded');
      }
      throw new Error(`Pixabay API error: ${response.statusText}`);
    }

    const data: PixabayResponse = await response.json();

    setCached(url, data);

    return data.hits.map((video) => mapVideoToClip(video));
  } catch (error) {
    console.error('Error fetching popular Pixabay videos:', error);
    throw error;
  }
}

function mapVideoToClip(video: PixabayVideo): FetchedClip {
  const videoFile = video.videos.large || video.videos.medium || video.videos.small;

  if (!videoFile) {
    throw new Error(`No video file found for Pixabay video ${video.id}`);
  }

  return {
    sourceId: `pixabay_${video.id}`,
    sourceUrl: video.pageURL,
    downloadUrl: videoFile.url,
    duration: video.duration,
    metadata: {
      width: videoFile.width,
      height: videoFile.height,
      tags: video.tags,
      size: videoFile.size,
      attribution_required: true,
      attribution_text: 'Pixabay',
      source_name: 'Pixabay',
      source_page_url: video.pageURL,
    },
  };
}

export async function fetchPixabayClips(query: string): Promise<SourceClip[]> {
  if (!ENV.PIXABAY_USERNAME) {
    return [];
  }

  const videos = await fetchPixabayVideos(query, 10, 1);
  return videos.map((video) => ({
    source: 'pixabay',
    source_id: video.sourceId,
    download_url: video.downloadUrl,
    duration: video.duration,
  }));
}
