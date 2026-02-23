import { NextResponse } from 'next/server';
import { supabase } from '@/src/utils/supabaseClient';

type AttentionItem = {
  id: string;
  type: 'failed_publish' | 'attribution_needed' | 'stuck_upload';
  title: string;

export async function GET() {
  try {
    const items: AttentionItem[] = [];
    const debug: Record<string, unknown> = {};

    // 1. Check for failed publishes
    const { data: failedPublishes, error: failedError } = await supabase
      .from('posting_queue')
      .select(`
        id,
        video_id,
        platform,
        error_message,
        updated_at,
        videos_final (
          analysis_id,
          analysis (
            hook
          )
        )
      `)
      .eq('status', 'failed')
      .order('updated_at', { ascending: false })
      .limit(5);
    debug.failedPublishes = { failedPublishes, failedError };

    if (failedError) {
      console.error('Error fetching failed publishes:', failedError);
      debug.failedError = failedError;
    } else if (failedPublishes) {
      for (const publish of failedPublishes as Array<Record<string, any>>) {
        const hook = publish.videos_final?.analysis?.hook || 'Untitled';
        items.push({
          id: publish.id,
          type: 'failed_publish',
          title: 'Failed publish',
          description: `${publish.platform} · "${hook}"`,
          videoId: publish.video_id,
          platform: publish.platform,
          timestamp: publish.updated_at || new Date().toISOString(),
        });
      }
    }

    // 2. Check for Pixabay clips needing attribution
    const { data: pixabayClips, error: pixabayError } = await supabase
      .from('clips_raw')
      .select(`
        id,
        source,
        source_id,
        created_at
      `)
      .eq('source', 'pixabay')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(10);
    debug.pixabayClips = { pixabayClips, pixabayError };

    if (pixabayError) {
      console.error('Error fetching Pixabay clips:', pixabayError);
      debug.pixabayError = pixabayError;
    } else if (pixabayClips && pixabayClips.length > 0) {
      const firstClip = pixabayClips[0] as { id: string; created_at: string };
      // Add one summary item for all Pixabay clips needing attribution
      items.push({
        id: 'pixabay-attribution',
        type: 'attribution_needed',
        title: 'Attribution needed',
        description: `${pixabayClips.length} Pixabay clip${pixabayClips.length > 1 ? 's' : ''} · show source in search results`,
        timestamp: firstClip.created_at,
      });
    }

    // 3. Check for stuck uploads (videos in processing/uploading for >30 minutes)
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: stuckVideos, error: stuckError } = await supabase
      .from('videos_final')
      .select(`
        id,
        segment_id,
        status,
        updated_at,
        analysis_id,
        analysis (
          hook
        ),
        posting_queue (
          platform
        )
      `)
      .in('status', ['uploading', 'processing'])
      .lt('updated_at', thirtyMinutesAgo)
      .order('updated_at', { ascending: true })
      .limit(5);
    debug.stuckVideos = { stuckVideos, stuckError };

    if (stuckError) {
      console.error('Error fetching stuck videos:', stuckError);
      debug.stuckError = stuckError;
    } else if (stuckVideos) {
      for (const video of stuckVideos as Array<Record<string, any>>) {
        const hook = video.analysis?.hook || 'Untitled';
        const platform = Array.isArray(video.posting_queue) && video.posting_queue.length > 0 ? video.posting_queue[0].platform : 'Unknown';
        items.push({
          id: video.id,
          type: 'stuck_upload',
          title: 'Stuck upload',
          description: `${platform} · "${hook}"`,
          videoId: video.id,
          platform,
          timestamp: video.updated_at || new Date().toISOString(),
        });
      }
    }

    // Sort by timestamp (most recent first)
    items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return NextResponse.json({
      success: true,
      items,
      summary: {
        failed: items.filter(i => i.type === 'failed_publish').length,
        stuck: items.filter(i => i.type === 'stuck_upload').length,
        attribution: items.filter(i => i.type === 'attribution_needed').length,
      },
      debug,
    });
  } catch (error) {
    console.error('Error fetching attention items:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch attention items', stack: error instanceof Error ? error.stack : undefined },
      { status: 500 }
    );
  }
}
  } catch (error) {
    console.error('Error fetching attention items:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch attention items', stack: error instanceof Error ? error.stack : undefined },
      { status: 500 }
    );
  }
}
