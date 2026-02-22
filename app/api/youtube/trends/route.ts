import { NextRequest, NextResponse } from 'next/server';
import { getYouTubeClient } from '@/lib/youtube';

export async function GET(req: NextRequest) {
  const accessToken = req.headers.get('authorization')?.replace('Bearer ', '') || '';
  const youtube = getYouTubeClient(accessToken);
  const days = Number(req.nextUrl.searchParams.get('days') || 28);
  // Placeholder: YouTube API does not provide direct trend line endpoint
  // You would need to fetch analytics data from YouTube Analytics API
  // This requires additional scopes and setup
  return NextResponse.json({ message: 'Trends endpoint requires YouTube Analytics API setup.' });
}
