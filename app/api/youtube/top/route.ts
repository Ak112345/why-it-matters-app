import { NextRequest, NextResponse } from 'next/server';
import { getYouTubeClient } from '@/lib/youtube';

export async function GET(req: NextRequest) {
  const accessToken = req.headers.get('authorization')?.replace('Bearer ', '') || '';
  const youtube = getYouTubeClient(accessToken);
  const days = Number(req.nextUrl.searchParams.get('days') || 7);
  const limit = Number(req.nextUrl.searchParams.get('limit') || 10);
  // Placeholder: YouTube API does not provide direct top videos endpoint
  // You would need to fetch videos and sort by performance metrics
  const searchRes = await youtube.search.list({
    part: ['snippet'],
    forMine: true,
    order: 'viewCount',
    maxResults: limit,
    type: ['video'],
  });
  return NextResponse.json(searchRes.data);
}
