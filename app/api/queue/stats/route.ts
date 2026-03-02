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
