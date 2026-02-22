import { NextRequest, NextResponse } from 'next/server';
import { cachedMetaApiRequest } from '@/lib/meta';

export async function GET(req: NextRequest) {
  const accessToken = req.headers.get('authorization')?.replace('Bearer ', '') || '';
  const igId = req.nextUrl.searchParams.get('igId');
  const fbPageId = req.nextUrl.searchParams.get('fbPageId');
  const days = Number(req.nextUrl.searchParams.get('days') || 28);
  let fbTrends = null;
  let igTrends = null;
  if (fbPageId) {
    fbTrends = await cachedMetaApiRequest(`${fbPageId}/insights`, accessToken, { period: 'day', metric: 'page_views,page_engaged_users', since: Date.now() - days * 86400000 }, 10);
  }
  if (igId) {
    igTrends = await cachedMetaApiRequest(`${igId}/insights`, accessToken, { period: 'day', metric: 'reach,profile_views', since: Date.now() - days * 86400000 }, 10);
  }
  return NextResponse.json({ facebook: fbTrends, instagram: igTrends });
}
