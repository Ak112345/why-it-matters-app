/**
 * API endpoint for posting queue statistics
 * GET /api/queue/stats - Get queue overview
 */

import { NextResponse } from 'next/server';
import { supabase } from '@/src/utils/supabaseClient';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Get all queue items
    const { data: queueItems, error } = await supabase
      .from('posting_queue')
      .select('id, platform, status, scheduled_for, created_at, final_video_id, error_message')
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
    const pending = items.filter((item: any) => item.status === 'pending').length;
    const failed = items.filter((item: any) => item.status === 'failed').length;
    const posted = items.filter((item: any) => item.status === 'posted').length;
    
    return NextResponse.json({
      pending,
      failed,
      posted,
      total: items.length
    });
  } catch (err: any) {
    console.error('[Queue Stats] Error:', err);
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}
      return acc;
    }, {});

    // Get next scheduled post
    const nextScheduled = scheduledItems
      .sort((a: any, b: any) => 
        new Date(a.scheduled_for).getTime() - new Date(b.scheduled_for).getTime()
      )[0];

    // Recent failures
    const recentFailures = failedItems
      .slice(0, 5)
      .map((item: any) => ({
        id: item.id,
        platform: item.platform,
        error: item.error_message,
        timestamp: item.created_at,
      }));

    return NextResponse.json({
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
        nextScheduled: nextScheduled ? {
          platform: nextScheduled.platform,
          scheduledFor: nextScheduled.scheduled_for,
          hasVideo: !!nextScheduled.final_video_id,
        } : null,
        recentFailures,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Queue stats error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch queue statistics' },
      { status: 500 }
    );
  }
}
