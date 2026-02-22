import { NextRequest, NextResponse } from 'next/server';
import { metaGet } from '@/lib/meta';

export async function GET(req: NextRequest) {
  const accessToken = req.headers.get('authorization')?.replace('Bearer ', '') || '';
  const fbPageId = req.nextUrl.searchParams.get('fbPageId');
  const igId = req.nextUrl.searchParams.get('igId');
  const fbFields = 'id,message,created_time,permalink_url';
  const igFields = 'id,caption,media_type,media_product_type,permalink,timestamp,like_count,comments_count,media_url,thumbnail_url';
  const fbPosts = fbPageId ? await metaGet(`${fbPageId}/posts`, accessToken, { fields: fbFields }, 10) : null;
  const igMedia = igId ? await metaGet(`${igId}/media`, accessToken, { fields: igFields }, 10) : null;
  return NextResponse.json({ facebook: fbPosts, instagram: igMedia });
}
