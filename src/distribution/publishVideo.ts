/**
 * src/distribution/publishVideo.ts
 * Publishes videos to Instagram, Facebook, and YouTube using real APIs
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface PublishOptions {
  queueId?: string;
  platform?: string;
  dryRun?: boolean;
}

export interface PublishResult {
  queueId: string;
  videoId: string;
  platform: string;
  success: boolean;
  postUrl?: string;
  error?: string;
}

// ─────────────────────────────────────────────
// Instagram (Meta Graph API)
// Docs: https://developers.facebook.com/docs/instagram-api/guides/reels-publishing
// ─────────────────────────────────────────────

async function publishToInstagram(
  videoUrl: string,
  caption: string
): Promise<{ success: boolean; postUrl?: string; error?: string }> {
  const igUserId = process.env.INSTAGRAM_USER_ID || process.env.META_IG_BUSINESS_ID;
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN || process.env.META_PAGE_ACESS_TOKEN;

  if (!igUserId || !accessToken) {
    return { success: false, error: 'Missing INSTAGRAM_USER_ID or INSTAGRAM_ACCESS_TOKEN' };
  }

  try {
    console.log('[publish] Instagram: Creating media container...');

    // Step 1: Create a Reels container
    const containerRes = await fetch(
      `https://graph.facebook.com/v19.0/${igUserId}/media`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          media_type: 'REELS',
          video_url: videoUrl,
          caption,
          access_token: accessToken,
        }),
      }
    );

    const containerData = await containerRes.json();

    if (!containerRes.ok || containerData.error) {
      throw new Error(containerData.error?.message || `Container creation failed: ${containerRes.status}`);
    }

    const containerId = containerData.id;
    console.log(`[publish] Instagram: Container created: ${containerId}`);

    // Step 2: Wait for video to be processed (poll up to 2 minutes)
    let mediaStatus = 'IN_PROGRESS';
    let attempts = 0;
    while (mediaStatus !== 'FINISHED' && attempts < 24) {
      await new Promise(r => setTimeout(r, 5000)); // wait 5s
      attempts++;

      const statusRes = await fetch(
        `https://graph.facebook.com/v19.0/${containerId}?fields=status_code&access_token=${accessToken}`
      );
      const statusData = await statusRes.json();
      mediaStatus = statusData.status_code || 'IN_PROGRESS';
      console.log(`[publish] Instagram: Status ${mediaStatus} (attempt ${attempts})`);

      if (mediaStatus === 'ERROR') {
        throw new Error('Instagram video processing failed');
      }
    }

    if (mediaStatus !== 'FINISHED') {
      throw new Error('Instagram video processing timed out');
    }

    // Step 3: Publish the container
    console.log('[publish] Instagram: Publishing...');
    const publishRes = await fetch(
      `https://graph.facebook.com/v19.0/${igUserId}/media_publish`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creation_id: containerId,
          access_token: accessToken,
        }),
      }
    );

    const publishData = await publishRes.json();

    if (!publishRes.ok || publishData.error) {
      throw new Error(publishData.error?.message || `Publish failed: ${publishRes.status}`);
    }

    const mediaId = publishData.id;
    console.log(`[publish] Instagram: Published! Media ID: ${mediaId}`);

    return {
      success: true,
      postUrl: `https://www.instagram.com/p/${mediaId}/`,
    };
  } catch (err: any) {
    console.error('[publish] Instagram error:', err.message);
    return { success: false, error: err.message };
  }
}

// ─────────────────────────────────────────────
// Facebook (Meta Graph API)
// Docs: https://developers.facebook.com/docs/video-api/guides/reels-publishing
// ─────────────────────────────────────────────

async function publishToFacebook(
  videoUrl: string,
  caption: string
): Promise<{ success: boolean; postUrl?: string; error?: string }> {
  const pageId = process.env.META_BUSINESS_FACEBOOK_ID;
  const accessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN || process.env.META_PAGE_ACESS_TOKEN;

  if (!pageId || !accessToken) {
    return { success: false, error: 'Missing META_BUSINESS_FACEBOOK_ID or FACEBOOK_PAGE_ACCESS_TOKEN' };
  }

  try {
    console.log('[publish] Facebook: Uploading reel...');

    // Step 1: Initialize upload session
    const initRes = await fetch(
      `https://graph.facebook.com/v19.0/${pageId}/video_reels`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          upload_phase: 'start',
          access_token: accessToken,
        }),
      }
    );

    const initData = await initRes.json();

    if (!initRes.ok || initData.error) {
      throw new Error(initData.error?.message || `Facebook init failed: ${initRes.status}`);
    }

    const videoId = initData.video_id;
    console.log(`[publish] Facebook: Upload session started, video ID: ${videoId}`);

    // Step 2: Finish upload with video URL
    const finishRes = await fetch(
      `https://graph.facebook.com/v19.0/${pageId}/video_reels`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          video_id: videoId,
          upload_phase: 'finish',
          video_state: 'PUBLISHED',
          description: caption,
          file_url: videoUrl,
          access_token: accessToken,
        }),
      }
    );

    const finishData = await finishRes.json();

    if (!finishRes.ok || finishData.error) {
      throw new Error(finishData.error?.message || `Facebook publish failed: ${finishRes.status}`);
    }

    console.log(`[publish] Facebook: Published! Video ID: ${videoId}`);

    return {
      success: true,
      postUrl: `https://www.facebook.com/reel/${videoId}`,
    };
  } catch (err: any) {
    console.error('[publish] Facebook error:', err.message);
    return { success: false, error: err.message };
  }
}

// ─────────────────────────────────────────────
// YouTube Shorts (YouTube Data API v3)
// Docs: https://developers.google.com/youtube/v3/guides/uploading_a_video
// ─────────────────────────────────────────────

async function refreshYouTubeToken(): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.YOUTUBE_CLIENT_ID!,
      client_secret: process.env.YOUTUBE_CLIENT_SECRET!,
      refresh_token: process.env.YOUTUBE_REFRESH_TOKEN!,
      grant_type: 'refresh_token',
    }),
  });

  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(`YouTube token refresh failed: ${data.error_description || res.status}`);
  }

  return data.access_token;
}

async function publishToYouTube(
  videoUrl: string,
  caption: string,
  hook: string
): Promise<{ success: boolean; postUrl?: string; error?: string }> {
  if (!process.env.YOUTUBE_CLIENT_ID || !process.env.YOUTUBE_CLIENT_SECRET || !process.env.YOUTUBE_REFRESH_TOKEN) {
    return { success: false, error: 'Missing YouTube OAuth credentials' };
  }

  try {
    console.log('[publish] YouTube: Refreshing access token...');
    const accessToken = await refreshYouTubeToken();

    // Step 1: Download the video to a buffer
    console.log('[publish] YouTube: Downloading video...');
    const videoRes = await fetch(videoUrl);
    if (!videoRes.ok) throw new Error(`Failed to download video: ${videoRes.status}`);
    const videoBuffer = Buffer.from(await videoRes.arrayBuffer());
    console.log(`[publish] YouTube: Downloaded ${(videoBuffer.length / 1024 / 1024).toFixed(1)}MB`);

    // Step 2: Initialize resumable upload
    const title = hook.length > 100 ? hook.substring(0, 97) + '...' : hook;
    const description = `${caption}\n\n#Shorts #viral #news #whyitmatters`;

    const initRes = await fetch(
      'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Upload-Content-Type': 'video/mp4',
          'X-Upload-Content-Length': videoBuffer.length.toString(),
        },
        body: JSON.stringify({
          snippet: {
            title,
            description,
            tags: ['shorts', 'viral', 'news', 'whyitmatters'],
            categoryId: '25', // News & Politics
          },
          status: {
            privacyStatus: 'public',
            selfDeclaredMadeForKids: false,
          },
        }),
      }
    );

    if (!initRes.ok) {
      const errText = await initRes.text();
      throw new Error(`YouTube upload init failed: ${initRes.status} ${errText}`);
    }

    const uploadUrl = initRes.headers.get('location');
    if (!uploadUrl) throw new Error('No upload URL returned from YouTube');

    console.log('[publish] YouTube: Uploading video...');

    // Step 3: Upload the video
    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': videoBuffer.length.toString(),
      },
      body: videoBuffer,
    });

    const uploadData = await uploadRes.json();

    if (!uploadRes.ok || uploadData.error) {
      throw new Error(uploadData.error?.message || `YouTube upload failed: ${uploadRes.status}`);
    }

    const youtubeVideoId = uploadData.id;
    console.log(`[publish] YouTube: Published! Video ID: ${youtubeVideoId}`);

    return {
      success: true,
      postUrl: `https://www.youtube.com/shorts/${youtubeVideoId}`,
    };
  } catch (err: any) {
    console.error('[publish] YouTube error:', err.message);
    return { success: false, error: err.message };
  }
}

// ─────────────────────────────────────────────
// Publish a single queue item
// ─────────────────────────────────────────────

async function publishSingleVideo(
  queueId: string,
  dryRun: boolean = false
): Promise<PublishResult> {
  try {
    // Fetch queue item with video
    const { data: queueItem, error: fetchError } = await supabase
      .from('posting_queue')
      .select(`
        *,
        videos_final (
          id,
          file_path,
          analysis_id
        )
      `)
      .eq('id', queueId)
      .single();

    if (fetchError || !queueItem) {
      throw new Error(`Queue item not found: ${queueId}`);
    }

    if (queueItem.status === 'posted') {
      return {
        queueId,
        videoId: queueItem.final_video_id || '',
        platform: queueItem.platform || '',
        success: true,
        postUrl: 'Already posted',
      };
    }

    const video = queueItem.videos_final as any;

    if (!video) {
      throw new Error(`Video not found for queue item ${queueId}`);
    }

    // Use file_path directly as video URL (it's already a full Supabase URL)
    const videoUrl = video.file_path;

    // Get caption from queue item or use a default
    const caption = queueItem.caption ||
      'The story nobody is telling. Follow for more. #whyitmatters #news #viral';

    // Get hook from produced_videos table if available
    let hook = caption;
    if (video.analysis_id) {
      const { data: analysis } = await supabase
        .from('analysis')
        .select('hook')
        .eq('id', video.analysis_id)
        .single();
      if (analysis?.hook) hook = analysis.hook;
    }

    console.log(`[publish] Publishing video ${video.id} to ${queueItem.platform}...`);
    console.log(`[publish] Video URL: ${videoUrl}`);
    console.log(`[publish] Caption: ${caption.substring(0, 80)}...`);

    if (dryRun) {
      console.log('[publish] DRY RUN — skipping actual publish');
      return {
        queueId,
        videoId: video.id,
        platform: queueItem.platform,
        success: true,
        postUrl: `dry-run://${queueItem.platform}/${Date.now()}`,
      };
    }

    // Route to correct platform
    let result: { success: boolean; postUrl?: string; error?: string };

    switch (queueItem.platform) {
      case 'instagram':
        result = await publishToInstagram(videoUrl, caption);
        break;
      case 'facebook':
        result = await publishToFacebook(videoUrl, caption);
        break;
      case 'youtube_shorts':
      case 'youtube':
        result = await publishToYouTube(videoUrl, caption, hook);
        break;
      default:
        result = { success: false, error: `Unknown platform: ${queueItem.platform}` };
    }

    // Update queue item status
    await supabase
      .from('posting_queue')
      .update({
        status: result.success ? 'posted' : 'failed',
        posted_at: result.success ? new Date().toISOString() : null,
        error_message: result.error || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', queueId);

    return {
      queueId,
      videoId: video.id,
      platform: queueItem.platform,
      success: result.success,
      postUrl: result.postUrl,
      error: result.error,
    };
  } catch (err: any) {
    console.error(`[publish] Error publishing ${queueId}:`, err.message);

    await supabase
      .from('posting_queue')
      .update({
        status: 'failed',
        error_message: err.message,
        updated_at: new Date().toISOString(),
      })
      .eq('id', queueId);

    return {
      queueId,
      videoId: '',
      platform: '',
      success: false,
      error: err.message,
    };
  }
}

// ─────────────────────────────────────────────
// Main exports
// ─────────────────────────────────────────────

export async function publishVideo(options: PublishOptions = {}): Promise<PublishResult[]> {
  const { queueId, platform, dryRun = false } = options;
  const results: PublishResult[] = [];

  // Publish specific queue item
  if (queueId) {
    const result = await publishSingleVideo(queueId, dryRun);
    results.push(result);
    return results;
  }

  // Publish all pending items that are due
  const now = new Date().toISOString();

  let query = supabase
    .from('posting_queue')
    .select('id')
    .eq('status', 'pending')
    .lte('scheduled_for', now);

  if (platform) {
    query = query.eq('platform', platform);
  }

  const { data: queueItems, error } = await query.order('scheduled_for', { ascending: true });

  if (error) throw error;
  if (!queueItems || queueItems.length === 0) {
    console.log('[publish] No pending posts due');
    return results;
  }

  console.log(`[publish] Found ${queueItems.length} posts due`);

  for (const item of queueItems) {
    const result = await publishSingleVideo(item.id, dryRun);
    results.push(result);
    await new Promise(r => setTimeout(r, 2000)); // rate limit buffer
  }

  return results;
}

export async function retryFailedPosts(limit: number = 10): Promise<PublishResult[]> {
  const { data: failedItems, error } = await supabase
    .from('posting_queue')
    .select('id')
    .eq('status', 'failed')
    .limit(limit);

  if (error || !failedItems?.length) {
    console.log('[publish] No failed posts to retry');
    return [];
  }

  const results: PublishResult[] = [];
  for (const item of failedItems) {
    await supabase
      .from('posting_queue')
      .update({ status: 'pending', updated_at: new Date().toISOString() })
      .eq('id', item.id);

    results.push(await publishSingleVideo(item.id));
  }

  return results;
}