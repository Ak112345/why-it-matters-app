/**
 * Fetch video clips from Pexels API
 */

import { ENV } from '../../utils/env.ts';

export interface PexelsVideo {
  id: number;
  url: string;
  duration: number;
  video_files: Array<{
    id: number;
    quality: string;
    file_type: string;
    width: number;
    height: number;
    link: string;
  }>;
}

export interface PexelsResponse {
  videos: PexelsVideo[];
  page: number;
  per_page: number;
  total_results: number;
}

export interface FetchedClip {
  sourceId: string;
  sourceUrl: string;
  downloadUrl: string;
  duration: number;
  metadata: Record<string, any>;
}

export interface SourceClip {
  source: 'pexels';
  source_id: string;
  download_url: string;
  duration?: number;
}

/**
 * Fetch videos from Pexels
 * @param query - Search query (e.g., "nature", "technology")
 * @param perPage - Number of videos to fetch (max 80)
 * @param page - Page number
 */
export async function fetchPexelsVideos(
  query: string = 'nature',
  perPage: number = 10,
  page: number = 1
): Promise<FetchedClip[]> {
  try {
    const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=${perPage}&page=${page}`;

    const response = await fetch(url, {
      headers: {
        Authorization: ENV.PEXELS_API_KEY,
      },
    });

    if (!response.ok) {
      throw new Error(`Pexels API error: ${response.statusText}`);
    }

    const data: PexelsResponse = await response.json();

    // Convert Pexels videos to our standard format
    return data.videos.map((video) => {
      // Get the best quality HD video file
      const hdVideo = video.video_files.find(
        (file) => file.quality === 'hd' && file.file_type === 'video/mp4'
      ) || video.video_files[0];

      return {
        sourceId: `pexels_${video.id}`,
        sourceUrl: video.url,
        downloadUrl: hdVideo.link,
        duration: video.duration,
        metadata: {
          width: hdVideo.width,
          height: hdVideo.height,
          quality: hdVideo.quality,
        },
      };
    });
  } catch (error) {
    console.error('Error fetching Pexels videos:', error);
    throw error;
  }
}

/**
 * Fetch popular videos from Pexels
 */
export async function fetchPopularPexelsVideos(
  perPage: number = 10,
  page: number = 1
): Promise<FetchedClip[]> {
  try {
    const url = `https://api.pexels.com/videos/popular?per_page=${perPage}&page=${page}`;

    const response = await fetch(url, {
      headers: {
        Authorization: ENV.PEXELS_API_KEY,
      },
    });

    if (!response.ok) {
      throw new Error(`Pexels API error: ${response.statusText}`);
    }

    const data: PexelsResponse = await response.json();

    return data.videos.map((video) => {
      const hdVideo = video.video_files.find(
        (file) => file.quality === 'hd' && file.file_type === 'video/mp4'
      ) || video.video_files[0];

      return {
        sourceId: `pexels_${video.id}`,
        sourceUrl: video.url,
        downloadUrl: hdVideo.link,
        duration: video.duration,
        metadata: {
          width: hdVideo.width,
          height: hdVideo.height,
          quality: hdVideo.quality,
        },
      };
    });
  } catch (error) {
    console.error('Error fetching popular Pexels videos:', error);
    throw error;
  }
}

export async function fetchPexelsClips(query: string): Promise<SourceClip[]> {
  if (!ENV.PEXELS_API_KEY) {
    return [];
  }

  const videos = await fetchPexelsVideos(query, 10, 1);
  return videos.map((video) => ({
    source: 'pexels',
    source_id: video.sourceId,
    download_url: video.downloadUrl,
    duration: video.duration,
  }));
}
