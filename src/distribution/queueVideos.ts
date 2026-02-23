// CLI handler: print approved, pending posts for all platforms if run directly
if (import.meta.url === `file://${process.cwd()}/src/distribution/queueVideos.ts`) {
  (async () => {
    console.log('Fetching approved, pending posts for all platforms...');
    try {
      const posts = await getUpcomingPosts(20);
      const platforms = ['tiktok', 'instagram', 'youtube_shorts'];
      for (const platform of platforms) {
        const filtered = posts.filter(p => p.platform === platform && p.status === 'pending' && p.videos_final && p.videos_final.status === 'approved');
        console.log(`\nPlatform: ${platform}`);
        if (filtered.length === 0) {
          console.log('No approved, pending posts.');
        } else {
          filtered.forEach(post => {
            console.log({
              id: post.id,
              scheduled_for: post.scheduled_for,
              video_id: post.final_video_id,
              caption: post.videos_final.caption,
              file_path: post.videos_final.file_path,
              hashtags: post.videos_final.analysis?.hashtags,
              quality_score: post.videos_final.analysis?.quality_score,
              virality_score: post.videos_final.analysis?.virality_score,
              approval_status: post.videos_final.analysis?.approval_status
            });
          });
        }
      }
    } catch (err) {
      console.error('Error fetching posts:', err);
    }
  })();
}
/**
 * Ensure queue always has approved videos ready to post
 * Replace rejected posts with next approved clip
 */
export async function maintainQueueBuffer(bufferSize: number = 3, platforms: Array<'instagram' | 'youtube_shorts' | 'tiktok'> = ['instagram', 'youtube_shorts', 'tiktok']) {
  // Get pending posts
  const { data: pendingPosts, error: pendingError } = await supabase
    .from('posting_queue')
    .select('id, final_video_id, platform, status, scheduled_for')
    .eq('status', 'pending');
  if (pendingError) throw pendingError;

  // Get approved videos not already queued
  const { data: approvedVideos, error: approvedError } = await supabase
    .from('videos_final')
    .select('id')
    .eq('status', 'approved');
  if (approvedError) throw approvedError;

  // Find queued video IDs
  const queuedIds = pendingPosts ? pendingPosts.map(p => p.final_video_id) : [];
  // Filter approved videos not already queued
  const unqueuedApproved = approvedVideos ? approvedVideos.filter(v => !queuedIds.includes(v.id)) : [];

  // Replace rejected posts
  for (const post of pendingPosts || []) {
    // Fetch video status
    let video = null;
    if (post.final_video_id) {
      const { data } = await supabase.from('videos_final').select('status').eq('id', post.final_video_id).single();
      video = data;
    }
    if (video && video.status === 'rejected') {
      // Remove rejected post
      await supabase.from('posting_queue').delete().eq('id', post.id);
      // Queue next approved video for same platform and time
      const nextClip = unqueuedApproved.shift();
      if (nextClip) {
        const validPlatforms = ["instagram", "youtube_shorts", "tiktok"] as const;
        if (
          post.platform &&
          validPlatforms.includes(post.platform as typeof validPlatforms[number]) &&
          post.scheduled_for
        ) {
          await queueSingleVideo(
            nextClip.id,
            [post.platform as "instagram" | "youtube_shorts" | "tiktok"],
            new Date(post.scheduled_for)
          );
        }
      }
    }
  }

  // Ensure buffer of approved videos
  let bufferCount = pendingPosts ? pendingPosts.filter(p => {
    const vid = approvedVideos.find(v => v.id === p.final_video_id);
    return vid && p.status === 'pending';
  }).length : 0;
  while (bufferCount < bufferSize && unqueuedApproved.length > 0) {
    const nextClip = unqueuedApproved.shift();
    if (nextClip) {
      await queueSingleVideo(nextClip.id, platforms);
    }
    bufferCount++;
  }
}
// CLI handler: print upcoming posts if run directly
if (import.meta.url === `file://${process.cwd()}/src/distribution/queueVideos.ts`) {
  (async () => {
    console.log('Fetching upcoming posts...');
    try {
      const posts = await getUpcomingPosts(10);
      console.log('Upcoming posts:', JSON.stringify(posts, null, 2));
    } catch (err) {
      console.error('Error fetching upcoming posts:', err);
    }
  })();
}
/**
 * Queue final videos for scheduled posting
 */

import { supabase } from '../utils/supabaseClient';

export interface QueueVideoOptions {
  videoId?: string; // If provided, queue only this video
  platform?: 'instagram' | 'youtube_shorts' | 'tiktok' | 'all';
  minHoursBetweenPosts?: number; // Custom interval for TikTok or others
  scheduledTime?: Date; // If not provided, schedule for next available slot
  batchSize?: number; // Number of videos to queue at once
}

export interface QueueResult {
  videoId: string;
  queueIds: string[];
  platforms: string[];
}

/**
 * Calculate next available posting time based on quiet hours strategy
 * This is a simplified version - you'd integrate with Quiet Hours API for real scheduling
 */
function calculateNextPostingTime(
  lastPostTime?: Date,
  minHoursBetweenPosts: number = 6
): Date {
  const now = new Date();
  
  if (!lastPostTime) {
    // If no previous posts, schedule for 1 hour from now
    return new Date(now.getTime() + 60 * 60 * 1000);
  }

  // Schedule for minHoursBetweenPosts after the last post
  const nextTime = new Date(lastPostTime.getTime() + minHoursBetweenPosts * 60 * 60 * 1000);
  
  // If that time has already passed, schedule for 1 hour from now
  if (nextTime < now) {
    return new Date(now.getTime() + 60 * 60 * 1000);
  }

  return nextTime;
}

/**
 * Queue a single video for posting
 */
async function queueSingleVideo(
  videoId: string,
  platforms: Array<'instagram' | 'youtube_shorts' | 'tiktok'>,
  scheduledTime?: Date,
  minHoursBetweenPosts: number = 6
): Promise<QueueResult> {
  try {
    // Fetch video to ensure it exists
    const { data: video, error: fetchError } = await supabase
      .from('videos_final')
      .select('*')
      .eq('id', videoId)
      .single();

    if (fetchError || !video) {
      throw new Error(`Video not found: ${videoId}`);
    }

    console.log(`Queueing video ${videoId} for ${platforms.join(', ')}...`);

    const queueIds: string[] = [];

    // Get last scheduled time for each platform
    for (const platform of platforms) {
      // Check if already queued
      const { data: existing } = await supabase
        .from('posting_queue')
        .select('id')
        .eq('video_id', videoId)
        .eq('platform', platform)
        .single();

      if (existing) {
        console.log(`Video ${videoId} already queued for ${platform}, skipping`);
        queueIds.push(existing.id);
        continue;
      }

      // Get the last scheduled time for this platform
      const { data: lastQueue } = await supabase
        .from('posting_queue')
        .select('scheduled_for')
        .eq('platform', platform)
        .order('scheduled_for', { ascending: false })
        .limit(1)
        .single();

      const lastTime = lastQueue && lastQueue.scheduled_for 
        ? new Date(lastQueue.scheduled_for) 
        : undefined;

      // Calculate scheduled time, ensure it's in the future and respects timezone
      let postTime = scheduledTime || calculateNextPostingTime(lastTime, minHoursBetweenPosts);
      const now = new Date();
      if (postTime < now) {
        // If scheduled time is in the past, schedule for 1 hour from now
        postTime = new Date(now.getTime() + 60 * 60 * 1000);
      }
      // Optionally adjust for APP_TIMEZONE if set
      const tz = process.env.APP_TIMEZONE || 'UTC';
      // If you want to use a library like luxon or date-fns-tz for timezone handling, add here
      // For now, just log the intended timezone
      console.log(`Scheduling post for ${platform} at ${postTime.toISOString()} (${tz})`);

      // Insert into posting queue
      const { data: queuedItem, error: insertError } = await supabase
        .from('posting_queue')
        .insert({
          final_video_id: videoId,
          platform,
          scheduled_for: postTime.toISOString(),
          status: 'pending',
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError) {
        console.error(`Failed to queue video for ${platform}:`, insertError);
        continue;
      }

      queueIds.push(queuedItem.id);
      console.log(`Queued for ${platform} at ${postTime.toISOString()}`);
    }

    return {
      videoId,
      queueIds,
      platforms: platforms,
    };
  } catch (error) {
    console.error(`Error queueing video ${videoId}:`, error);
    throw error;
  }
}

/**
 * Queue videos for posting
 */
export async function queueVideos(options: QueueVideoOptions = {}): Promise<QueueResult[]> {
  const {
    videoId,
    platform = 'all',
    scheduledTime,
    batchSize = 10,
    minHoursBetweenPosts = 6,
  } = options;

  const results: QueueResult[] = [];

  // Determine which platforms to post to
  const platforms: Array<'instagram' | 'youtube_shorts' | 'tiktok'> =
    platform === 'all'
      ? ['instagram', 'youtube_shorts', 'tiktok']
      : [platform];

  try {
    // If specific video ID provided, queue only that video
    if (videoId) {
      const result = await queueSingleVideo(videoId, platforms, scheduledTime, minHoursBetweenPosts);
      results.push(result);
      return results;
    }

    // Otherwise, queue all unqueued videos (prioritize by production date)
    const { data: videos, error: fetchError } = await supabase
      .from('videos_final')
      .select('id')
      .order('produced_at', { ascending: false })
      .limit(batchSize);

    if (fetchError) {
      throw fetchError;
    }

    if (!videos || videos.length === 0) {
      console.log('No videos found to queue');
      return results;
    }
    console.log(`Found ${videos.length} videos to check for queueing`);

    for (const video of videos) {
      try {
        const result = await queueSingleVideo(video.id, platforms, scheduledTime, minHoursBetweenPosts);
        results.push(result);
      } catch (error) {
        console.error(`Failed to queue video ${video.id}:`, error);
      }
    }

    console.log(`Queueing complete: ${results.length} videos queued`);
    return results;
  } catch (error) {
    console.error('Error during video queueing:', error);
    throw error;
  }
}

/**
 * Get upcoming posts in the queue
 */
export async function getUpcomingPosts(limit: number = 20): Promise<any[]> {
  const { data, error } = await supabase
    .from('posting_queue')
    .select(`
      *,
      videos_final (
        *,
        analysis (*)
      )
    `)
    .eq('status', 'pending')
    .order('scheduled_time', { ascending: true })
    .limit(limit);

  if (error) {
    throw error;
  }

  return data || [];
}


/**
 * Cancel a queued post
 */
export async function cancelQueuedPost(queueId: string): Promise<void> {
  const { error } = await supabase
    .from('posting_queue')
    .delete()
    .eq('id', queueId);

  if (error) {
    throw error;
  }

  console.log(`Cancelled queued post ${queueId}`);
}

/**
 * Reschedule a queued post
 */
export async function reschedulePost(queueId: string, newTime: Date): Promise<void> {
  const { error } = await supabase
    .from('posting_queue')
    .update({ scheduled_for: newTime.toISOString() })
    .eq('id', queueId);

  if (error) {
    throw error;
  }

  console.log(`Rescheduled post ${queueId} to ${newTime.toISOString()}`);
}
