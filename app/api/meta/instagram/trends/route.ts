import { NextRequest, NextResponse } from 'next/server';
import { fetchMeta } from '@/lib/meta';

export async function GET(req: NextRequest) {
  const accessToken = req.headers.get('authorization')?.replace('Bearer ', '') || '';
  const igId = req.nextUrl.searchParams.get('igId');
  const days = Number(req.nextUrl.searchParams.get('days') || 28);
  if (!igId) return NextResponse.json({ error: 'Missing igId' }, { status: 400 });
  // Placeholder: Instagram account insights (requires business account)
  return NextResponse.json({ message: 'Trends endpoint requires Instagram Insights API setup.' });
}
