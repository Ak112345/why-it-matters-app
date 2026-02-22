import { NextRequest, NextResponse } from 'next/server';
import { fetchMeta } from '@/lib/meta';

export async function GET(req: NextRequest) {
  const accessToken = req.headers.get('authorization')?.replace('Bearer ', '') || '';
  const igId = req.nextUrl.searchParams.get('igId');
  const days = Number(req.nextUrl.searchParams.get('days') || 7);
  const limit = Number(req.nextUrl.searchParams.get('limit') || 10);
  if (!igId) return NextResponse.json({ error: 'Missing igId' }, { status: 400 });
  // Fetch media and sort by like_count or comments_count
  const fields = 'id,caption,media_type,media_product_type,permalink,timestamp,like_count,comments_count,media_url,thumbnail_url';
  const media = await fetchMeta(`${igId}/media`, accessToken, { fields, limit });
  const sorted = (media.data || []).sort((a: any, b: any) => (b.like_count || 0) + (b.comments_count || 0) - ((a.like_count || 0) + (a.comments_count || 0));
  return NextResponse.json({ top: sorted.slice(0, limit) });
}
