import { NextRequest, NextResponse } from 'next/server';
import { getYouTubeClient } from '@/lib/youtube';

export async function GET(req: NextRequest) {
  const accessToken = req.headers.get('authorization')?.replace('Bearer ', '') || '';
  const youtube = getYouTubeClient(accessToken);
  const limit = Number(req.nextUrl.searchParams.get('limit') || 20);
  const searchRes = await youtube.search.list({
    part: ['snippet'],
    forMine: true,
    order: 'date',
    maxResults: limit,
    type: ['video'],
  });
  return NextResponse.json(searchRes.data);
}
