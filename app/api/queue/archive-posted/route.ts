export const dynamic = 'force-dynamic';

/**
 * Cron endpoint to clean up old posted queue rows
 * GET /api/queue/archive-posted
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function isAuthorized(request: Request): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET;

  if (!cronSecret) return true;
  return authHeader === `Bearer ${cronSecret}`;
}

export async function GET(request: Request) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      return NextResponse.json(
        { success: false, error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' },
        { status: 500 }
      );
    }

    const supabase = createClient(url, key);

    const requestUrl = new URL(request.url);
    const days = Math.max(1, Number(requestUrl.searchParams.get('days') || '30'));
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { data: candidates, error: fetchError } = await supabase
      .from('posting_queue')
      .select('id')
      .eq('status', 'posted')
      .lt('updated_at', cutoff)
      .limit(1000);

    if (fetchError) {
      throw new Error(fetchError.message);
    }

    const ids = (candidates || []).map((row: { id: string }) => row.id);

    if (ids.length === 0) {
      return NextResponse.json({
        success: true,
        message: `No posted rows older than ${days} day(s)`,
        deleted: 0,
        cutoff,
      });
    }

    const { error: deleteError } = await supabase
      .from('posting_queue')
      .delete()
      .in('id', ids);

    if (deleteError) {
      throw new Error(deleteError.message);
    }

    return NextResponse.json({
      success: true,
      message: `Archived ${ids.length} posted queue row(s) older than ${days} day(s)`,
      deleted: ids.length,
      cutoff,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
