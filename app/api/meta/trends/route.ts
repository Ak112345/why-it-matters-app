export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { metaGet } from '@/lib/meta';

export async function GET(req: Request) {
  const accessToken = req.headers.get('authorization')?.replace('Bearer ', '') || '';
  const url = new URL(req.url);
  const igId = url.searchParams.get('igId');
  const fbPageId = url.searchParams.get('fbPageId');
  const days = Number(url.searchParams.get('days') || 28);
  let fbTrends = null;
  let igTrends = null;
  if (fbPageId) {
    fbTrends = await metaGet<any>(
      `${fbPageId}/insights?period=day&metric=page_views,page_engaged_users&since=${Date.now() - days * 86400000}`,
      accessToken
    );
  }
  if (igId) {
    igTrends = await metaGet<any>(
      `${igId}/insights?period=day&metric=reach,profile_views&since=${Date.now() - days * 86400000}`,
      accessToken
    );
  }
  return NextResponse.json({ facebook: fbTrends, instagram: igTrends });
}
