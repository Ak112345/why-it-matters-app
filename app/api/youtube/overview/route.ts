import { NextRequest, NextResponse } from 'next/server';
import { getYouTubeClient } from '@/lib/youtube';

export async function GET(req: NextRequest) {
  const accessToken = req.headers.get('authorization')?.replace('Bearer ', '') || '';
  const youtube = getYouTubeClient(accessToken);
  const channelRes = await youtube.channels.list({
    mine: true,
    part: ['snippet', 'statistics', 'brandingSettings'],
  });
  return NextResponse.json(channelRes.data);
}
