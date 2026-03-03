/**
 * src/distribution/publishVideo.ts
 * Publishes videos to Instagram, Facebook, and YouTube using real APIs
 */

import { createClient } from '@supabase/supabase-js';
import { checkPlatformTokenHealth } from './tokenHealth';

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

function extractStoragePathFromUrl(videoUrl: string, bucket: string): string | null {
  if (!videoUrl) return null;

  const decoded = decodeURIComponent(videoUrl);
  const patterns = [
    `/storage/v1/object/public/${bucket}/`,
    `/storage/v1/object/authenticated/${bucket}/`,
    `/storage/v1/object/sign/${bucket}/`,
  ];

  for (const pattern of patterns) {
    const index = decoded.indexOf(pattern);
    if (index >= 0) {
      return decoded.substring(index + pattern.length).split('?')[0];
    }
  }

  if (decoded.startsWith(`${bucket}/`)) {
    return decoded.substring(bucket.length + 1).split('?')[0];
  }

  return null;
}

async function moveVideoToPostedBucket(videoId: string, videoUrl: string): Promise<{ moved: boolean; storageUri?: string; error?: string }> {
  const sourceBucket = 'final_videos';
  const targetBucket = process.env.POSTED_VIDEOS_BUCKET || 'videos_already_posted';

  if (targetBucket === sourceBucket) {
    return { moved: false, error: 'POSTED_VIDEOS_BUCKET matches source bucket; skipping move' };
  }

  const sourcePath = extractStoragePathFromUrl(videoUrl, sourceBucket);
  if (!sourcePath) {
    return { moved: false, error: 'Could not parse source storage path from video URL' };
  }

  const extension = sourcePath.includes('.') ? sourcePath.split('.').pop() : 'mp4';
  const targetPath = `${new Date().toISOString().slice(0, 10)}/${videoId}.${extension}`;

  const { data: fileBlob, error: downloadError } = await supabase.storage
    .from(sourceBucket)
    .download(sourcePath);

  if (downloadError || !fileBlob) {
    return { moved: false, error: `Download failed: ${downloadError?.message || 'no file returned'}` };
  }

  const { error: uploadError } = await supabase.storage
    .from(targetBucket)
    .upload(targetPath, fileBlob, {
      contentType: 'video/mp4',
      upsert: true,
    });

  if (uploadError) {
    return { moved: false, error: `Upload failed: ${uploadError.message}` };
  }

  const { error: removeError } = await supabase.storage
    .from(sourceBucket)
    .remove([sourcePath]);

  if (removeError) {
    console.warn(`[publish] Video copied to ${targetBucket} but source removal failed: ${removeError.message}`);
  }

  return {
    moved: true,
    storageUri: `storage://${targetBucket}/${targetPath}`,
  };
}

// ─────────────────────────────────────────────
// TikTok (Storage for manual batch scheduling)
// ─────────────────────────────────────────────

async function uploadToTikTokStorage(
  videoId: string,
  videoUrl: string,
  caption: string
): Promise<{ success: boolean; postUrl?: string; error?: string }> {
  try {
    console.log('[publish] TikTok: Copying video to TikTok storage...');

    // Create a metadata entry in posting_queue with special status
    // The video is already in final_videos bucket, just mark as ready for manual scheduling
    const metadataPath = `tiktok_ready/${videoId}.json`;
    
    const metadata = {
      videoId,
      videoUrl,
      caption,
      readyAt: new Date().toISOString(),
      platform: 'tiktok',
      instructions: 'Ready for manual batch scheduling via TikTok Creator Tools'
    };

    // Store metadata in Supabase storage
    const { error: uploadError } = await supabase.storage
      .from('final_videos')
      .upload(metadataPath, JSON.stringify(metadata, null, 2), {
        contentType: 'application/json',
        upsert: true
      });

    if (uploadError) {
      throw new Error(`Failed to save TikTok metadata: ${uploadError.message}`);
    }

    console.log(`[publish] TikTok: Video ${videoId} ready for manual scheduling`);
    console.log(`[publish] TikTok: Metadata saved to ${metadataPath}`);

    return {
      success: true,
      postUrl: `storage://tiktok_ready/${videoId}`,
    };
  } catch (error: any) {
    console.error('[publish] TikTok storage error:', error.message);
    return { success: false, error: error.message };
  }
}

// ─────────────────────────────────────────────
// Instagram (Meta Graph API)
// Docs: https://developers.facebook.com/docs/instagram-api/guides/reels-publishing
// ─────────────────────────────────────────────

async function publishToInstagram(
  videoUrl: string,
  caption: string
): Promise<{ success: boolean; postUrl?: string; error?: string }> {
  const igUserId = process.env.META_IG_BUSINESS_ID || process.env.INSTAGRAM_USER_ID || process.env.INSTAGRAM_BUSINESS_ID;
  
  if (!igUserId) {
    return { success: false, error: 'Missing META_IG_BUSINESS_ID' };
  }

  try {
    // Get fresh access token
    console.log('[publish] Instagram: Refreshing access token...');
    const accessToken = await refreshInstagramToken();
    
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
  const pageId = process.env.FACEBOOK_PAGE_ID || process.env.META_BUSINESS_FACEBOOK_ID;

  if (!pageId) {
    return { success: false, error: 'Missing FACEBOOK_PAGE_ID' };
  }

  try {
    // Get fresh access token
    console.log('[publish] Facebook: Refreshing access token...');
    const accessToken = await refreshMetaPageToken();
    
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

/**
 * Refresh YouTube access token using refresh token
 * Tokens expire after 1 hour, this generates a fresh one
 */
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

  console.log('[token] YouTube access token refreshed successfully');
  return data.access_token;
}

/**
 * Refresh Meta/Facebook page access token using long-lived user token
 * Page tokens can be refreshed from user tokens, with fallback to stored token
 */
async function refreshMetaPageToken(): Promise<string> {
  const pageId = process.env.FACEBOOK_PAGE_ID;
  const userToken = process.env.META_USER_ACCESS_TOKEN;
  const fallbackPageToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;

  if (!pageId) {
    throw new Error('Missing FACEBOOK_PAGE_ID');
  }

  if (!userToken) {
    console.warn('[token] META_USER_ACCESS_TOKEN not set, using fallback page token');
    if (!fallbackPageToken) {
      throw new Error('Missing both META_USER_ACCESS_TOKEN and FACEBOOK_PAGE_ACCESS_TOKEN');
    }
    return fallbackPageToken;
  }

  try {
    // Try to get fresh page access token from user token
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${pageId}?fields=access_token,name&access_token=${userToken}`
    );

    const data = await res.json();

    if (!res.ok) {
      const errorMsg = data.error?.message || `Status ${res.status}`;
      const errorCode = data.error?.code || 'UNKNOWN';
      console.error(`[token] Meta token refresh failed (${errorCode}): ${errorMsg}`);
      
      // If user token is expired, we need the user to re-authenticate
      if (errorCode === 190 || errorMsg.includes('Session has expired') || errorMsg.includes('Invalid access token')) {
        console.error('[token] User access token appears to be expired. Please re-authenticate.');
        if (fallbackPageToken) {
          console.warn('[token] Falling back to cached page token (may be expired)');
          return fallbackPageToken;
        }
        throw new Error(`User token expired or invalid. Error: ${errorMsg}`);
      }

      // Other errors - try fallback
      if (fallbackPageToken) {
        console.warn(`[token] Falling back to cached page token: ${errorMsg}`);
        return fallbackPageToken;
      }
      throw new Error(errorMsg);
    }

    if (!data.access_token) {
      console.error('[token] No access_token in response:', data);
      if (fallbackPageToken) {
        console.warn('[token] Falling back to cached page token');
        return fallbackPageToken;
      }
      throw new Error('No access_token returned from Meta API');
    }

    console.log('[token] Meta page access token refreshed successfully for page:', data.name);
    return data.access_token;
  } catch (err: any) {
    console.error('[token] Meta token refresh error:', err.message);
    
    // Last resort: use fallback token
    if (fallbackPageToken) {
      console.warn('[token] Using fallback cached page token due to error');
      return fallbackPageToken;
    }
    throw err;
  }
}

/**
 * Refresh Instagram access token (uses same page token as Facebook)
 */
async function refreshInstagramToken(): Promise<string> {
  return refreshMetaPageToken();
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
    // Get fresh access token (auto-refreshes every time)
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
    let shouldReschedule = false;

    // TikTok: Upload to storage for manual batch scheduling
    if (queueItem.platform === 'tiktok') {
      result = await uploadToTikTokStorage(video.id, videoUrl, caption);
    } else {
      const tokenHealth = await checkPlatformTokenHealth(queueItem.platform);
      if (!tokenHealth.ok) {
        shouldReschedule = true; // Auth failures should be rescheduled
        result = {
          success: false,
          error: `Token health check failed: ${tokenHealth.error}`,
        };
      } else {
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
      }

      // Check if failure is auth-related and should be rescheduled
      if (!result.success && result.error) {
        const authErrors = [
          'token',
          'auth',
          'unauthorized',
          'expired',
          'invalid oauth',
          'permission',
          'credential'
        ];
        const isAuthError = authErrors.some(keyword => 
          result.error!.toLowerCase().includes(keyword)
        );
        if (isAuthError) {
          shouldReschedule = true;
        }
      }
    }

    // Update queue item status
    if (shouldReschedule && !result.success) {
      // Reschedule auth failures for 1 hour from now
      const newScheduledFor = new Date();
      newScheduledFor.setHours(newScheduledFor.getHours() + 1);
      
      console.log(`[publish] Rescheduling ${queueId} due to auth error...`);
      
      await supabase
        .from('posting_queue')
        .update({
          status: 'pending',
          scheduled_for: newScheduledFor.toISOString(),
          error_message: `[Auto-rescheduled] ${result.error}`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', queueId);
    } else {
      const nowIso = new Date().toISOString();

      await supabase
        .from('posting_queue')
        .update({
          status: result.success ? 'posted' : 'failed',
          posted_at: result.success ? nowIso : null,
          error_message: result.error || null,
          updated_at: nowIso,
        })
        .eq('id', queueId);

      if (result.success) {
        const { data: existingVideo } = await supabase
          .from('videos_final')
          .select('times_posted, file_path')
          .eq('id', video.id)
          .single();

        let updatedFilePath: string | undefined;
        const currentVideoPath = existingVideo?.file_path || video.file_path;
        const moveResult = await moveVideoToPostedBucket(video.id, currentVideoPath);
        if (moveResult.moved && moveResult.storageUri) {
          updatedFilePath = moveResult.storageUri;
          console.log(`[publish] Moved video ${video.id} to posted bucket`);
        } else if (moveResult.error) {
          console.warn(`[publish] Could not move video ${video.id} to posted bucket: ${moveResult.error}`);
        }

        const currentTimesPosted = existingVideo?.times_posted ?? 0;
        await supabase
          .from('videos_final')
          .update({
            times_posted: currentTimesPosted + 1,
            last_posted_at: nowIso,
            status: 'posted',
            ...(updatedFilePath ? { file_path: updatedFilePath } : {}),
            updated_at: nowIso,
          })
          .eq('id', video.id);
      }
    }

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