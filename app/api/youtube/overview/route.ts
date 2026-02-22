import { NextResponse } from "next/server";
import { getYoutubeClients } from "@/lib/youtube";

export async function GET() {
  try {
    const { youtube } = getYoutubeClients();

    const res = await youtube.channels.list({
      part: ["snippet", "statistics"],
      mine: true,
    });

    const ch = res.data.items?.[0];
    if (!ch) return NextResponse.json({ error: "No channel found for this auth." }, { status: 404 });

    return NextResponse.json({
      id: ch.id,
      title: ch.snippet?.title,
      thumbnail: ch.snippet?.thumbnails?.default?.url,
      stats: ch.statistics,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}