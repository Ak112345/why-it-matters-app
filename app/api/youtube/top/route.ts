import { NextResponse } from "next/server";
import { getYoutubeClients } from "@/lib/youtube";

function yyyyMmDd(d: Date) {
  return d.toISOString().slice(0, 10);
}

export async function GET(req: Request) {
  try {
    const { youtube, ytAnalytics } = getYoutubeClients();
    const url = new URL(req.url);

    const days = Math.min(Math.max(Number(url.searchParams.get("days") ?? "7"), 1), 90);
    const max = Math.min(Number(url.searchParams.get("limit") ?? "10"), 25);

    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);

    // Analytics: top videos by views
    const report = await ytAnalytics.reports.query({
      ids: "channel==MINE",
      startDate: yyyyMmDd(start),
      endDate: yyyyMmDd(end),
      metrics: "views,estimatedMinutesWatched,averageViewDuration",
      dimensions: "video",
      sort: "-views",
      maxResults: max,
    });

    const rows = report.data.rows ?? [];
    const videoIds = rows.map((r) => String(r[0]));

    // Hydrate titles/thumbnails
    const vids =
      videoIds.length > 0
        ? await youtube.videos.list({
            part: ["snippet", "statistics"],
            id: videoIds,
            maxResults: max,
          })
        : null;

    const meta = new Map(
      (vids?.data.items ?? []).map((v) => [
        v.id,
        {
          title: v.snippet?.title,
          thumbnail: v.snippet?.thumbnails?.medium?.url,
          publishedAt: v.snippet?.publishedAt,
        },
      ])
    );

    const items = rows.map((r) => {
      const id = String(r[0]);
      const views = Number(r[1] ?? 0);
      const minutesWatched = Number(r[2] ?? 0);
      const avgViewDurationSec = Number(r[3] ?? 0);

      return {
        id,
        ...meta.get(id),
        views,
        minutesWatched,
        avgViewDurationSec,
      };
    });

    return NextResponse.json({ days, items });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}