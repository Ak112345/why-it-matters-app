import { NextRequest, NextResponse } from 'next/server';
import { cachedMetaApiRequest } from '@/lib/meta';

export async function GET(req: NextRequest) {
  const accessToken = req.headers.get('authorization')?.replace('Bearer ', '') || '';
  const fbPageId = req.nextUrl.searchParams.get('fbPageId');
  const igId = req.nextUrl.searchParams.get('igId');
  const fbFields = 'name,fan_count,followers_count';
  const igFields = 'username,followers_count,media_count';
  const fbOverview = fbPageId ? await cachedMetaApiRequest(`${fbPageId}`, accessToken, { fields: fbFields }, 10) : null;
  const igOverview = igId ? await cachedMetaApiRequest(`${igId}`, accessToken, { fields: igFields }, 10) : null;
  return NextResponse.json({ facebook: fbOverview, instagram: igOverview });
}
