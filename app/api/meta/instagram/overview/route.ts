import { NextRequest, NextResponse } from 'next/server';
import { fetchMeta } from '@/lib/meta';

export async function GET(req: NextRequest) {
  const accessToken = req.headers.get('authorization')?.replace('Bearer ', '') || '';
  const igId = req.nextUrl.searchParams.get('igId');
  if (!igId) return NextResponse.json({ error: 'Missing igId' }, { status: 400 });
  const fields = 'username,followers_count,media_count';
  const overview = await fetchMeta(`${igId}`, accessToken, { fields });
  return NextResponse.json(overview);
}
