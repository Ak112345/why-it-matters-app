import { NextResponse } from "next/server";
import { getYoutubeClients } from "@/lib/youtube";

function yyyyMmDd(d: Date) {
  return d.toISOString().slice(0, 10);
}

export async function GET(req: Request) {
  try {
    const { ytAnalytics } = getYoutubeClients();
    const url = new URL(req.url);

    const days = Math.min(Math.max(Number(url.searchParams.get("days") ?? "28"), 7), 180);

    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);

    const report = await ytAnalytics.reports.query({
      ids: "channel==MINE",
      startDate: yyyyMmDd(start),
      endDate: yyyyMmDd(end),
      metrics: "views,estimatedMinutesWatched",
      dimensions: "day",
      sort: "day",
    });

    const rows = report.data.rows ?? [];
    const points = rows.map((r) => ({
      day: String(r[0]),
      views: Number(r[1] ?? 0),
      minutesWatched: Number(r[2] ?? 0),
    }));

    return NextResponse.json({ days, points });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}