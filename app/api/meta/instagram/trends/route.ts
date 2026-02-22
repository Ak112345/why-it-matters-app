import { NextResponse } from "next/server";
import { getMetaEnv, metaGet } from "@/lib/meta";

export async function GET(req: Request) {
  try {
    const { igId, token } = getMetaEnv();
    const url = new URL(req.url);
    const days = Math.min(Math.max(Number(url.searchParams.get("days") ?? "28"), 7), 90);

    const until = Math.floor(Date.now() / 1000);
    const since = until - days * 24 * 60 * 60;

    // Pick a small stable set for daily trends. :contentReference[oaicite:7]{index=7}
    const metric = ["reach", "profile_views"].join(",");

    const data = await metaGet<any>(
      `${igId}/insights?metric=${encodeURIComponent(metric)}&period=day&since=${since}&until=${until}`,
      token
    );

    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}