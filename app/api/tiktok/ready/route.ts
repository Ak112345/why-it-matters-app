/**
 * API endpoint for TikTok video management
 * GET /api/tiktok/ready - List videos ready for manual batch scheduling
 */

import { NextResponse } from 'next/server';
import { supabase } from '@/src/utils/supabaseClient';

export async function GET() {
  try {
    // Get all TikTok posts that have been "posted" (actually uploaded to storage)
    const { data: tiktokPosts, error } = await supabase
      .from('posting_queue')
      .select(`
        id,
        platform,
        status,
        caption,
        scheduled_for,
        posted_at,
        created_at,
        final_video_id
      `)
      .eq('platform', 'tiktok')
      .eq('status', 'posted')
      .order('posted_at', { ascending: false });

    if (error) {
      console.error('Error fetching TikTok videos:', error);
      return NextResponse.json(
        { error: 'Failed to fetch TikTok videos' },
        { status: 500 }
      );
    }

    // For each post, get the video details
    const videos = await Promise.all((tiktokPosts || []).map(async (post: any) => {
      if (!post.final_video_id) return null;
      
      const { data: video } = await supabase
        .from('produced_videos')
        .select('id, video_url')
        .eq('id', post.final_video_id)
        .single();

      return {
        id: post.id,
        videoId: post.final_video_id,
        videoUrl: video?.video_url,
        caption: post.caption,
        readyAt: post.posted_at,
        scheduledFor: post.scheduled_for,
        createdAt: post.created_at,
      };
    }));

    const validVideos = videos.filter(v => v !== null);

    // Also check for metadata files in storage
    const { data: files, error: storageError } = await supabase.storage
      .from('final_videos')
      .list('tiktok_ready', {
        limit: 100,
        offset: 0,
      });

    const metadataFiles = files?.filter(f => f.name.endsWith('.json')) || [];

    return NextResponse.json({
      success: true,
      data: {
        count: validVideos.length,
        videos: validVideos,
        metadataFiles: metadataFiles.map(f => ({
          name: f.name,
          createdAt: f.created_at,
          size: f.metadata?.size,
        })),
        instructions: [
          '1. Download videos from the URLs provided',
          '2. Open TikTok Creator Tools (https://www.tiktok.com/creator-tools/)',
          '3. Upload videos in batch',
          '4. Use the provided captions',
          '5. Schedule posts according to your content calendar',
        ],
      },
    });
  } catch (error) {
    console.error('TikTok ready videos error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch TikTok videos' },
      { status: 500 }
    );
  }
}
