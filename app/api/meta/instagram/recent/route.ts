import { NextRequest, NextResponse } from 'next/server';
import { fetchMeta } from '@/lib/meta';

export async function GET(req: NextRequest) {
  const accessToken = req.headers.get('authorization')?.replace('Bearer ', '') || '';
  const igId = req.nextUrl.searchParams.get('igId');
  if (!igId) return NextResponse.json({ error: 'Missing igId' }, { status: 400 });
  const fields = 'id,caption,media_type,media_product_type,permalink,timestamp,like_count,comments_count,media_url,thumbnail_url';
  const media = await fetchMeta(`${igId}/media`, accessToken, { fields, limit: 20 });
  return NextResponse.json(media);
}
