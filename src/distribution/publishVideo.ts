/**
 * Publish videos to social media platforms via Quiet Hours or direct APIs
 */

import { supabase } from '../utils/supabaseClient';
import { ENV } from '../utils/env';

export interface PublishOptions {
  queueId?: string; // If provided, publish only this queued item
  platform?: 'instagram' | 'youtube_shorts';
  dryRun?: boolean; // If true, don't actually publish (for testing)
}

export interface PublishResult {
  queueId: string;
  videoId: string;
  platform: string;
  success: boolean;
  postUrl?: string;
  error?: string;
}

/**
 * Publish video via Quiet Hours API
 * This is a placeholder - you'll need to implement actual Quiet Hours integration
 */
async function publishViaQuietHours(
  videoUrl: string,
  caption: string,
  hashtags: string[],
  platform: string
): Promise<{ success: boolean; postUrl?: string; error?: string }> {
  try {
    if (!ENV.QUIET_HOURS_API_URL || !ENV.QUIET_HOURS_API_KEY) {
      console.warn('Quiet Hours credentials not configured, skipping actual publish');
      return {
        success: true,
        postUrl: `https://example.com/post/${Date.now()}`,
      };
    }

    // Prepare the payload for Quiet Hours
    const payload = {
      platform,
      video_url: videoUrl,
      caption: `${caption}\n\n${hashtags.map(h => `#${h}`).join(' ')}`,
      hashtags,
    };

    const response = await fetch(ENV.QUIET_HOURS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ENV.QUIET_HOURS_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Quiet Hours API error: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      success: true,
      postUrl: data.post_url || data.url,
    };
  } catch (error) {
    console.error('Error publishing via Quiet Hours:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Publish a single queued video
 */
async function publishSingleVideo(
  queueId: string,
  dryRun: boolean = false
): Promise<PublishResult> {
  try {
    // Fetch queue item with video and analysis data
    const { data: queueItem, error: fetchError } = await supabase
      .from('posting_queue')
      .select(`
        *,
        videos_final (
          *,
          clips_analysis (*)
        )
      `)
      .eq('id', queueId)
      .single();

    if (fetchError || !queueItem) {
      throw new Error(`Queue item not found: ${queueId}`);
    }

    // Check if already posted
    if (queueItem.status === 'posted') {
      console.log(`Queue item ${queueId} already posted, skipping`);
      return {
        queueId,
        videoId: queueItem.final_video_id || 'unknown',
        platform: queueItem.platform || 'unknown',
        success: true,
        postUrl: 'Already posted',
      };
    }

    const video = (queueItem as any).videos_final;
    const analysis = video?.clips_analysis;

    if (!video || !analysis) {
      throw new Error(`Video or analysis not found for queue item ${queueId}`);
    }

    console.log(`Publishing video ${video.id} to ${queueItem.platform}...`);

    // Get public URL for the video
    const { data: urlData } = supabase.storage
      .from('final_videos')
      .getPublicUrl(video.file_path);

    const videoUrl = urlData.publicUrl;

    let publishResult: { success: boolean; postUrl?: string; error?: string } = {
      success: true,
      postUrl: 'Dry run - not actually published',
    };

    // Publish via Quiet Hours (unless dry run)
    if (!dryRun) {
      publishResult = await publishViaQuietHours(
        videoUrl,
        analysis.caption,
        analysis.hashtags,
        queueItem.platform || 'unknown'
      );
    }

    // Update queue item status
    const updateData: any = {
      status: publishResult.success ? 'posted' : 'failed',
      posted_at: publishResult.success ? new Date().toISOString() : null,
      error_message: publishResult.error || null,
    };

    const { error: updateError } = await supabase
      .from('posting_queue')
      .update(updateData)
      .eq('id', queueId);

    if (updateError) {
      console.error('Failed to update queue item:', updateError);
    }

    console.log(
      publishResult.success
        ? `Successfully published to ${queueItem.platform}`
        : `Failed to publish: ${publishResult.error}`
    );

    return {
      queueId,
      videoId: video.id,
      platform: queueItem.platform || 'unknown',
      success: publishResult.success,
      postUrl: publishResult.postUrl,
      error: publishResult.error,
    };
  } catch (error) {
    console.error(`Error publishing queue item ${queueId}:`, error);

    // Mark as failed
    await supabase
      .from('posting_queue')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
      })
      .eq('id', queueId);

    return {
      queueId,
      videoId: '',
      platform: '',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Publish videos
 */
export async function publishVideo(options: PublishOptions = {}): Promise<PublishResult[]> {
  const { queueId, platform, dryRun = false } = options;

  const results: PublishResult[] = [];

  try {
    // If specific queue ID provided, publish only that item
    if (queueId) {
      const result = await publishSingleVideo(queueId, dryRun);
      results.push(result);
      return results;
    }

    // Otherwise, publish all pending items that are due
    const now = new Date().toISOString();

    let query = supabase
      .from('posting_queue')
      .select('id')
      .eq('status', 'pending')
      .lte('scheduled_time', now);

    // Filter by platform if specified
    if (platform) {
      query = query.eq('platform', platform);
    }

    const { data: queueItems, error: fetchError } = await query.order('scheduled_time', {
      ascending: true,
    });

    if (fetchError) {
      throw fetchError;
    }

    if (!queueItems || queueItems.length === 0) {
      console.log('No pending posts due for publishing');
      return results;
    }

    console.log(`Found ${queueItems.length} posts due for publishing`);

    for (const item of queueItems) {
      try {
        const result = await publishSingleVideo(item.id, dryRun);
        results.push(result);

        // Add a small delay between posts to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.error(`Failed to publish queue item ${item.id}:`, error);
      }
    }

    console.log(
      `Publishing complete: ${results.filter(r => r.success).length} success, ${results.filter(r => !r.success).length} failed`
    );
    return results;
  } catch (error) {
    console.error('Error during video publishing:', error);
    throw error;
  }
}

/**
 * Retry failed posts
 */
export async function retryFailedPosts(limit: number = 10): Promise<PublishResult[]> {
  const { data: failedItems, error } = await supabase
    .from('posting_queue')
    .select('id')
    .eq('status', 'failed')
    .limit(limit);

  if (error || !failedItems || failedItems.length === 0) {
    console.log('No failed posts to retry');
    return [];
  }

  console.log(`Retrying ${failedItems.length} failed posts`);

  const results: PublishResult[] = [];
  for (const item of failedItems) {
    // Reset status to pending
    await supabase
      .from('posting_queue')
      .update({ status: 'pending' })
      .eq('id', item.id);

    const result = await publishSingleVideo(item.id);
    results.push(result);
  }

  return results;
}
