import { NextResponse } from 'next/server';
import { metaGet } from '@/lib/meta';

export async function GET() {
  const accessToken = req.headers.get('authorization')?.replace('Bearer ', '') || '';
  const igId = req.nextUrl.searchParams.get('igId');
  // Instagram: fetch carousels (media_type=CAROUSEL_ALBUM)
  if (!igId) return NextResponse.json({ error: 'Missing igId' }, { status: 400 });
  const mediaRes = await metaGet<{ data: any[] }>(
    `${igId}/m   Linting and checking validity of types ...
 ⚠ No ESLint configuration detected. Run next lint to begin setup
   Collecting page data ...
FFmpeg not found at /usr/bin/ffmpeg, using default
   Generating static pages (0/34) ...
Error fetching failed publishes: {
  code: '42703',
  details: null,
  hint: 'Perhaps you meant to reference the column "posting_queue.posted_at" or the column "posting_queue.created_at".',
  message: 'column posting_queue.posted_at does not exist'
}
   Generating static pages (8/34)    Linting and checking validity of types ...
 ⚠ No ESLint configuration detected. Run next lint to begin setup
   Collecting page data ...
FFmpeg not found at /usr/bin/ffmpeg, using default
   Generating static pages (0/34) ...
Error fetching failed publishes: {
  code: '42703',
  details: null,
  hint: 'Perhaps you meant to reference the column "posting_queue.posted_at" or the column "posting_queue.created_at".',
  message: 'column posting_queue.posted_at does not exist'
}
   Generating static pages (8/34) edia?fields=id,caption,media_type,media_product_type,permalink,timestamp,like_count,comments_count,media_url,thumbnail_url&limit=20`,
    accessToken
  );
  const carousels = (mediaRes.data || []).filter((item: any) => item.media_type === 'CAROUSEL_ALBUM');
  return NextResponse.json({ carousels });
}
