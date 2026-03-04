// app/api/analytics/timeline/route.ts
// Returns daily aggregates for timeline charts

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const daysBack = parseInt(searchParams.get('daysBack') || '30', 10);
    const platform = searchParams.get('platform'); // optional filter
    const cutoffDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();

    let query = supabase
      .from('post_analytics')
      .select('posted_at, total_views, total_engagements, platform')
      .gte('posted_at', cutoffDate)
      .order('posted_at', { ascending: true });

    if (platform) {
      query = query.eq('platform', platform);
    }

    const { data, error } = await query;

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    // Group by date
    const timeline: { [key: string]: { date: string; count: number; views: number; engagements: number } } = {};
    
    data?.forEach((post) => {
      const date = new Date(post.posted_at).toISOString().split('T')[0]; // YYYY-MM-DD
      if (!timeline[date]) {
        timeline[date] = { date, count: 0, views: 0, engagements: 0 };
      }
      timeline[date].count += 1;
      timeline[date].views += post.total_views || 0;
      timeline[date].engagements += post.total_engagements || 0;
    });

    const timelineData = Object.values(timeline).sort((a, b) => a.date.localeCompare(b.date));

    return Response.json({
      success: true,
      data: timelineData,
      daysBack,
      platform: platform || 'all',
    });
  } catch (error: any) {
    return Response.json(
      { error: error?.message || 'Failed to fetch timeline' },
      { status: 500 }
    );
  }
}
