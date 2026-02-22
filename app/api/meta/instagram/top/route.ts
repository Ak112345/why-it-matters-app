import { NextResponse } from "next/server";
import { getMetaEnv, metaGet } from "@/lib/meta";

type Insight = { name: string; values: Array<{ value: number }> };

function latestValue(ins: Insight[] | undefined, key: string) {
  const found = ins?.find((m) => m.name === key);
  const v = found?.values?.[0]?.value;
  return typeof v === "number" ? v : 0;
}

async function getMediaInsights(mediaId: string, token: string, metrics: string[]) {
  // IG media insights are requested per-media; metrics vary by media type. :contentReference[oaicite:3]{index=3}
  const qs = `metric=${encodeURIComponent(metrics.join(","))}`;
  return metaGet<{ data: Insight[] }>(`${mediaId}/insights?${qs}`, token);
}

export async function GET(req: Request) {
  try {
    const { igId, token } = getMetaEnv();
    const url = new URL(req.url);
    const limit = Math.min(Number(url.searchParams.get("limit") ?? "15"), 25);

    const media = await metaGet<{
      data: Array<{
        id: string;
        caption?: string;
        media_type?: string;
        media_product_type?: string;
        permalink?: string;
        timestamp?: string;
        thumbnail_url?: string;
        media_url?: string;
      }>;
    }>(
      `${igId}/media?fields=id,caption,media_type,media_product_type,permalink,timestamp,thumbnail_url,media_url&limit=${limit}`,
      token
    );

    const items = await Promise.all(
      (media.data ?? []).map(async (m) => {
        const isReel =
          (m.media_product_type || "").toUpperCase() === "REELS" ||
          (m.media_type || "").toUpperCase() === "VIDEO";

        // Recommended approach: pick metric sets based on media type; fallback if Meta rejects a metric. :contentReference[oaicite:4]{index=4}
        const primary = isReel
          ? ["plays", "reach", "total_interactions", "shares", "saves"]
          : ["reach", "total_interactions", "shares", "saves"];

        let insights: Insight[] = [];
        try {
          const res = await getMediaInsights(m.id, token, primary);
          insights = res.data ?? [];
        } catch {
          // fallback to a smaller “least likely to error” set
          const fallback = isReel ? ["plays", "reach"] : ["reach"];
          const res = await getMediaInsights(m.id, token, fallback);
          insights = res.data ?? [];
        }

        const plays = latestValue(insights, "plays");
        const reach = latestValue(insights, "reach");
        const totalInteractions = latestValue(insights, "total_interactions");

        // One score so mixed content ranks cleanly:
        const score = isReel ? plays || reach : reach || totalInteractions;

        return {
          ...m,
          isReel,
          insights: { plays, reach, totalInteractions },
          score,
        };
      })
    );

    items.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    return NextResponse.json({ items });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}