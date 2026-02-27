import { NextResponse } from 'next/server';
import { supabase } from '@/src/utils/supabaseClient';

export const dynamic = 'force-dynamic';

type AttentionItem = {
  id: string;
  type: 'failed_publish' | 'attribution_needed' | 'stuck_upload';
  title: string;
  description: string;
  videoId?: string;
  platform?: string;
  timestamp?: string;
};

export async function GET() {
  try {
    const items: AttentionItem[] = [];

    const { data: failedPublishes, error: failedError } = await supabase
      .from('posting_queue')
      .select('id, video_id, platform, error_message, updated_at')
      .eq('status', 'failed')
      .order('updated_at', { ascending: false })
      .limit(5);

    if (!failedError && failedPublishes) {
      for (const publish of failedPublishes as Array<Record<string, unknown>>) {
        items.push({
          id: publish.id as string,
          type: 'failed_publish',
          title: 'Failed publish',
          description: String(publish.platform || 'Unknown platform'),
          videoId: publish.video_id as string,
          platform: publish.platform as string,
          timestamp: publish.updated_at as string,
        });
      }
    }

    const { data: pixabayClips, error: pixabayError } = await supabase
      .from('clips_raw')
      .select('id, source, created_at')
      .eq('source', 'pixabay')
      .eq('status', 'active')
      .limit(10);

    if (!pixabayError && pixabayClips && pixabayClips.length > 0) {
      items.push({
        id: 'pixabay-attribution',
        type: 'attribution_needed',
        title: 'Attribution needed',
        description: `${pixabayClips.length} Pixabay clip${pixabayClips.length > 1 ? 's' : ''}`,
        timestamp: (pixabayClips[0] as Record<string, unknown>).created_at as string,
      });
    }

    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: stuckVideos, error: stuckError } = await supabase
      .from('videos_final')
      .select('id, status, updated_at')
      .in('status', ['uploading', 'processing'])
      .lt('updated_at', thirtyMinutesAgo)
      .limit(5);

    if (!stuckError && stuckVideos) {
      for (const video of stuckVideos as Array<Record<string, unknown>>) {
        items.push({
          id: video.id as string,
          type: 'stuck_upload',
          title: 'Stuck upload',
          description: `Status: ${video.status}`,
          videoId: video.id as string,
          timestamp: video.updated_at as string,
        });
      }
    }

    items.sort((a, b) =>
      new Date(b.timestamp ?? 0).getTime() - new Date(a.timestamp ?? 0).getTime()
    );

    return NextResponse.json({
      success: true,
      items,
      summary: {
        failed: items.filter(i => i.type === 'failed_publish').length,
        stuck: items.filter(i => i.type === 'stuck_upload').length,
        attribution: items.filter(i => i.type === 'attribution_needed').length,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
