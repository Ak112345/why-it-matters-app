import { NextResponse } from "next/server";
import { getMetaEnv, metaGet } from "@/lib/meta";

export async function GET(req: Request) {
  try {
    const { igId, token } = getMetaEnv();
    const url = new URL(req.url);
    const limit = Math.min(Number(url.searchParams.get("limit") ?? "20"), 50);

    const data = await metaGet<{
      data: Array<{
        id: string;
        caption?: string;
        media_type?: string;
        media_product_type?: string; // REELS often shows here
        permalink?: string;
        timestamp?: string;
        like_count?: number;
        comments_count?: number;
        thumbnail_url?: string;
        media_url?: string;
      }>;
    }>(
      `${igId}/media?fields=id,caption,media_type,media_product_type,permalink,timestamp,like_count,comments_count,thumbnail_url,media_url&limit=${limit}`,
      token
    );

    return NextResponse.json({ items: data.data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}