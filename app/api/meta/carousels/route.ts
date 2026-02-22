import { NextRequest, NextResponse } from 'next/server';
import { metaGet } from '@/lib/meta';

export async function GET(req: NextRequest) {
  const accessToken = req.headers.get('authorization')?.replace('Bearer ', '') || '';
  const igId = req.nextUrl.searchParams.get('igId');
  // Instagram: fetch carousels (media_type=CAROUSEL_ALBUM)
  if (!igId) return NextResponse.json({ error: 'Missing igId' }, { status: 400 });
  const mediaRes = await metaGet<{ data: any[] }>(
    `${igId}/media?fields=id,caption,media_type,media_product_type,permalink,timestamp,like_count,comments_count,media_url,thumbnail_url&limit=20`,
    accessToken
  );
  const carousels = (mediaRes.data || []).filter((item: any) => item.media_type === 'CAROUSEL_ALBUM');
  return NextResponse.json({ carousels });
}
