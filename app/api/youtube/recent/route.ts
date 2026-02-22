import { NextResponse } from "next/server";
import { getYoutubeClients } from "@/lib/youtube";

export async function GET(req: Request) {
  try {
    const { youtube } = getYoutubeClients();
    const url = new URL(req.url);
    const limit = Math.min(Number(url.searchParams.get("limit") ?? "20"), 50);

    // Get uploads playlist id
    const chRes = await youtube.channels.list({
      part: ["contentDetails"],
      mine: true,
    });

    const uploadsPlaylistId =
      chRes.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;

    if (!uploadsPlaylistId) {
      return NextResponse.json({ error: "Uploads playlist not found." }, { status: 404 });
    }

    const plRes = await youtube.playlistItems.list({
      part: ["snippet", "contentDetails"],
      playlistId: uploadsPlaylistId,
      maxResults: limit,
    });

    const videoIds =
      plRes.data.items?.map((i) => i.contentDetails?.videoId).filter(Boolean) as string[];

    // Hydrate privacy status + stats
    const vidsRes = videoIds.length
      ? await youtube.videos.list({
          part: ["snippet", "status", "statistics", "contentDetails"],
          id: videoIds,
          maxResults: limit,
        })
      : null;

    const videos =
      vidsRes?.data.items?.map((v) => ({
        id: v.id,
        title: v.snippet?.title,
        publishedAt: v.snippet?.publishedAt,
        thumbnail: v.snippet?.thumbnails?.medium?.url,
        privacyStatus: v.status?.privacyStatus,
        isShort:
          (v.contentDetails?.duration && isLikelyShort(v.contentDetails.duration)) || false,
        views: v.statistics?.viewCount,
      })) ?? [];

    // Keep playlist order (YouTube may return videos.list in different order)
    const byId = new Map(videos.map((v) => [v.id, v]));
    const ordered = videoIds.map((id) => byId.get(id)).filter(Boolean);

    return NextResponse.json({ items: ordered });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}

// ISO 8601 duration: PT#M#S. Shorts are <= 60 seconds.
function isLikelyShort(isoDuration: string) {
  // super small parser
  const match = isoDuration.match(/PT(?:(\d+)M)?(?:(\d+)S)?/);
  const m = match?.[1] ? Number(match[1]) : 0;
  const s = match?.[2] ? Number(match[2]) : 0;
  const total = m * 60 + s;
  return total > 0 && total <= 60;
}