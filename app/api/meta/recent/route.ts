export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { metaGet } from '@/lib/meta';

export async function GET(req: Request) {
  const accessToken = req.headers.get('authorization')?.replace('Bearer ', '') || '';
  const url = new URL(req.url);
  const fbPageId = url.searchParams.get('fbPageId');
  const igId = url.searchParams.get('igId');
  const fbFields = 'id,message,created_time,permalink_url';
  const igFields = 'id,caption,media_type,media_product_type,permalink,timestamp,like_count,comments_count,media_url,thumbnail_url';
  const fbPosts = fbPageId ? await metaGet<{ data: any[] }>(
    `${fbPageId}/posts?fields=${fbFields}`,
    accessToken
  ) : null;
  const igMedia = igId ? await metaGet<{ data: any[] }>(
    `${igId}/media?fields=${igFields}`,
    accessToken
  ) : null;
  return NextResponse.json({ facebook: fbPosts, instagram: igMedia });
}
