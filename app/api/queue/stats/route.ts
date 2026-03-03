/**
 * API endpoint for posting queue statistics
 * GET /api/queue/stats - Get queue overview
 */

import { NextResponse } from 'next/server';
import { supabase } from '@/src/utils/supabaseClient';

export const revalidate = 0; // Always fresh
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Get all queue items (exclude archived for active queue stats)
    const { data: queueItems, error } = await supabase
      .from('posting_queue')
      .select('id, platform, status, scheduled_for, created_at, final_video_id, error_message')
      .neq('status', 'archived') // Exclude archived posts
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching queue stats:', error);
      return NextResponse.json(
        { error: 'Failed to fetch queue statistics' },
        { status: 500 }
      );
    }

    const items = queueItems || [];

    // Calculate statistics
    const now = new Date();
    const pendingItems = items.filter((item: any) => item.status === 'pending');
    const failedItems = items.filter((item: any) => item.status === 'failed');
    const postedItems = items.filter((item: any) => item.status === 'posted');
    const scheduledItems = items.filter(
      (item: any) =>
        item.scheduled_for &&
        new Date(item.scheduled_for).getTime() > now.getTime()
    );
    const readyToPost = items.filter(
      (item: any) =>
        item.status === 'pending' &&
        item.final_video_id &&
        item.scheduled_for &&
        new Date(item.scheduled_for).getTime() <= now.getTime()
    );

    const byPlatform = items.reduce((acc: any, item: any) => {
      const platform = item.platform || 'unknown';
      if (!acc[platform]) {
        acc[platform] = { total: 0, pending: 0, failed: 0, posted: 0 };
      }
      acc[platform].total += 1;
      if (item.status === 'pending') acc[platform].pending += 1;
      if (item.status === 'failed') acc[platform].failed += 1;
      if (item.status === 'posted') acc[platform].posted += 1;
      return acc;
    }, {} as Record<string, { total: number; pending: number; failed: number; posted: number }>);

    const nextScheduled = scheduledItems
      .sort((a: any, b: any) => new Date(a.scheduled_for).getTime() - new Date(b.scheduled_for).getTime())[0];

    const recentFailures = failedItems.slice(0, 5).map((item: any) => ({
      id: item.id,
      platform: item.platform,
      error: item.error_message,
      timestamp: item.created_at,
    }));

    const response = NextResponse.json({
      success: true,
      data: {
        summary: {
          total: items.length,
          pending: pendingItems.length,
          failed: failedItems.length,
          posted: postedItems.length,
          scheduled: scheduledItems.length,
          readyToPost: readyToPost.length,
        },
        byPlatform,
        nextScheduled: nextScheduled
          ? {
              platform: nextScheduled.platform,
              scheduledFor: nextScheduled.scheduled_for,
              hasVideo: !!nextScheduled.final_video_id,
            }
          : null,
        recentFailures,
        timestamp: new Date().toISOString(),
      },
      pending: pendingItems.length,
      failed: failedItems.length,
      posted: postedItems.length,
      total: items.length,
    });

    // Ensure no caching
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');

    return response;
  } catch (err: any) {
    console.error('[Queue Stats] Error:', err);
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}
