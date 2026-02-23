import { NextResponse } from 'next/server';
import { metaGet } from '@/lib/meta';

export async function GET() {
  const accessToken = req.headers.get('authorization')?.replace('Bearer ', '') || '';
  const fbPageId = req.nextUrl.searchParams.get('fbPageId');
  const igId = req.nextUrl.searchParams.get('igId');
  const limit = Number(req.nextUrl.searchParams.get('limit') || 10);
  let fbPosts = [];
  let igMedia = [];
  if (fbPageId) {
    const fbPostsRes = await metaGet<{ data: any[] }>(
      `${fbPageId}/posts?fields=id&limit=${limit}`,
      accessToken
    );
    fbPosts = fbPostsRes.data || [];
    // Fetch insights for each post (simplified)
    fbPosts = await Promise.all(fbPosts.map(async (post: any) => {
      const insights = await metaGet<any>(
        `${post.id}/insights`,
        accessToken
      );
      return { ...post, insights };
    }));
  }
  if (igId) {
    const igMediaRes = await metaGet<{ data: any[] }>(
      `${igId}/media?fields=id&limit=${limit}`,
      accessToken
    );
    igMedia = igMediaRes.data || [];
    igMedia = await Promise.all(igMedia.map(async (media: any) => {
      const insights = await metaGet<any>(
        `${media.id}/insights`,
        accessToken
      );
      return { ...media, insights };
    }));
  }
  // Sort by reach or total_interactions if available
  fbPosts.sort((a: any, b: any) => (b.insights?.reach || 0) - (a.insights?.reach || 0));
  igMedia.sort((a: any, b: any) => (b.insights?.reach || 0) - (a.insights?.reach || 0));
  return NextResponse.json({ facebook: fbPosts, instagram: igMedia });
}
