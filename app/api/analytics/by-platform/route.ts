// app/api/analytics/by-platform/route.ts
// Returns platform aggregates (count, sum of views, avg engagement rate)

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const daysBack = parseInt(searchParams.get('daysBack') || '30', 10);
    const cutoffDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();

    // Raw SQL query for aggregation
    const { data, error } = await supabase.rpc('get_platform_stats', {
      since_date: cutoffDate,
    }).catch(async () => {
      // Fallback: manual aggregation if RPC not available
      const { data: posts, error: queryError } = await supabase
        .from('post_analytics')
        .select('platform, total_views, total_engagements, engagement_rate')
        .gte('posted_at', cutoffDate);

      if (queryError) throw queryError;

      // Manual aggregation
      const aggregated: { [key: string]: any } = {};
      posts?.forEach((post) => {
        if (!aggregated[post.platform]) {
          aggregated[post.platform] = {
            platform: post.platform,
            count: 0,
            total_views: 0,
            total_engagements: 0,
            avg_engagement_rate: 0,
            views_sum: 0,
          };
        }
        aggregated[post.platform].count += 1;
        aggregated[post.platform].total_views += post.total_views || 0;
        aggregated[post.platform].total_engagements += post.total_engagements || 0;
        aggregated[post.platform].views_sum += post.engagement_rate || 0;
      });

      return {
        data: Object.values(aggregated).map((agg: any) => ({
          ...agg,
          avg_engagement_rate: agg.count > 0 ? (agg.views_sum / agg.count).toFixed(2) : 0,
        })),
        error: null,
      };
    });

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({
      success: true,
      data,
      daysBack,
    });
  } catch (error: any) {
    return Response.json(
      { error: error?.message || 'Failed to fetch platform stats' },
      { status: 500 }
    );
  }
}
