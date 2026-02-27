export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { metaGet } from '@/lib/meta';

export async function GET() {
  const accessToken = req.headers.get('authorization')?.replace('Bearer ', '') || '';
  const fbPageId = req.nextUrl.searchParams.get('fbPageId');
  const igId = req.nextUrl.searchParams.get('igId');
  const fbFields = 'name,fan_count,followers_count';
  const igFields = 'username,followers_count,media_count';
  const fbOverview = fbPageId ? await metaGet<{ name?: string; fan_count?: number; followers_count?: number }>(
    `${fbPageId}?fields=${fbFields}`,
    accessToken
  ) : null;
  const igOverview = igId ? await metaGet<{ username?: string; followers_count?: number; media_count?: number }>(
    `${igId}?fields=${igFields}`,
    accessToken
  ) : null;
  return NextResponse.json({ facebook: fbOverview, instagram: igOverview });
}
