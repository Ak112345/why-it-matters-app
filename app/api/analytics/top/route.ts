// app/api/analytics/top/route.ts
// Returns top-performing posts by views/engagement

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const platform = searchParams.get('platform'); // optional filter
    const sortBy = searchParams.get('sortBy') || 'total_views'; // total_views | engagement_rate

    let query = supabase
      .from('post_analytics')
      .select('id, job_id, platform, total_views, total_engagements, engagement_rate, posted_at')
      .order(sortBy, { ascending: false })
      .limit(limit);

    if (platform) {
      query = query.eq('platform', platform);
    }

    const { data, error } = await query;

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({
      success: true,
      data,
      count: data?.length || 0,
    });
  } catch (error: any) {
    return Response.json(
      { error: error?.message || 'Failed to fetch top posts' },
      { status: 500 }
    );
  }
}
