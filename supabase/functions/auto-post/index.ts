// supabase/functions/auto-post/index.ts
// Updated: TikTok removed from API posting — handled via batch storage bucket instead

// Define PostRecord interface above imports to avoid hoisting issues
interface PostRecord {
  id: string;
  clip_url: string;
  clip_path: string;
  caption: string;
  hashtags: string;
  thumbnail_url?: string;
  platforms: string[];
  status: "queued" | "posting" | "posted" | "failed";
  scheduled_at: string;
  tiktok_caption?: string;   // Optional TikTok-specific caption override
  tiktok_hashtags?: string;  // Optional TikTok-specific hashtags override
}

import type { NextApiRequest, NextApiResponse } from "next";
import { createClient, SupabaseClient } from "@supabase/supabase-js";


const API_PLATFORMS = ["instagram", "youtube", "facebook"]; // Auto-posted via API

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  try {
    const authHeader = req.headers['authorization'];
    const cronSecret = process.env.CRON_SECRET || 'test123';
    if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL || "",
      process.env.SUPABASE_SERVICE_ROLE_KEY || ""
    );

    const body = req.method === "POST" ? req.body || {} : {};
    const source = body.source ?? "cron";

    // Fetch next queued post due now
    const { data: posts, error: fetchError } = await supabase
      .from("posts")
      .select("*")
      .eq("status", "queued")
      .lte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(1);

    if (fetchError) throw fetchError;

    if (!posts || posts.length === 0) {
      return res.status(200).json({ message: "No posts queued for now", posted: 0 });
    }

    const post: PostRecord = posts[0];

    // Lock post immediately to prevent double-posting
    await supabase
      .from("posts")
      .update({ status: "posting", updated_at: new Date().toISOString() })
      .eq("id", post.id);

    const results: Record<string, { success: boolean; error?: string; detail?: unknown }> = {};

    // ── 1. API platforms: Instagram, YouTube, Facebook ────────────────────────
    const apiTargets = post.platforms.filter((p) => API_PLATFORMS.includes(p));
    for (const platform of apiTargets) {
      try {
        const result = await postToPlatform(platform, post);
        results[platform] = { success: true, detail: result };
      } catch (err) {
        results[platform] = { success: false, error: String(err) };
      }
    }

    // ── 2. TikTok: write to tiktok-batch storage bucket ──────────────────────
    if (post.platforms.includes("tiktok")) {
      try {
        await queueTikTokBatch(supabase, post);
        results["tiktok"] = { success: true, detail: "Added to tiktok-batch bucket" };
      } catch (err) {
        results["tiktok"] = { success: false, error: String(err) };
      }
    }

    // ── 3. Final status ───────────────────────────────────────────────────────
    const allFailed = Object.values(results).every((r) => !r.success);
    const finalStatus = allFailed ? "failed" : "posted";

    await supabase
      .from("posts")
      .update({
        status: finalStatus,
        post_results: results,
        posted_at: finalStatus === "posted" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", post.id);

    await supabase.from("post_history").insert({
      post_id: post.id,
      triggered_at: new Date().toISOString(),
      results,
      status: finalStatus,
      source,
    });

    return res.status(200).json({ message: `Post ${finalStatus}`, post_id: post.id, results });
  } catch (error) {
    console.error("Auto-post error:", error);
    return res.status(500).json({ error: String(error) });
  }
}

// ─── TikTok Batch Queue ───────────────────────────────────────────────────────

async function queueTikTokBatch(supabase: SupabaseClient, post: PostRecord) {
  const today = new Date().toISOString().split("T")[0]; // e.g. "2025-02-22"

  const caption = post.tiktok_caption ?? post.caption;
  const hashtags = post.tiktok_hashtags ?? post.hashtags;

  const suggestedTimes = [
    "7:00 AM EST  (12:00 UTC) — Morning commute scroll",
    "12:00 PM EST (17:00 UTC) — Lunch break scroll",
    "7:00 PM EST  (00:00 UTC) — Prime evening time",
  ];

  // Build companion .txt file
  const txtContent = [
    `POST ID: ${post.id}`,
    `DATE: ${today}`,
    ``,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `CAPTION (copy/paste into TikTok):`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    caption,
    ``,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `HASHTAGS:`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    hashtags,
    ``,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `SUGGESTED POSTING TIMES:`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    ...suggestedTimes,
    ``,
    `VIDEO FILE: ${post.id}.mp4`,
    `SOURCE URL: ${post.clip_url}`,
  ].join("\n");

  // Upload companion .txt to tiktok-batch bucket
  const txtPath = `${today}/${post.id}.txt`;
  const { error: txtError } = await supabase.storage
    .from("tiktok-batch")
    .upload(txtPath, new Blob([txtContent], { type: "text/plain" }), { upsert: true });
  if (txtError) throw new Error(`TXT upload failed: ${txtError.message}`);

  // Register in tiktok_batch table
  const { error: dbError } = await supabase.from("tiktok_batch").insert({
    post_id: post.id,
    batch_date: today,
    clip_url: post.clip_url,
    clip_path: post.clip_path,
    caption,
    hashtags,
    suggested_times: suggestedTimes,
    txt_path: txtPath,
    status: "ready",
    created_at: new Date().toISOString(),
  });
  if (dbError) throw new Error(`DB insert failed: ${dbError.message}`);
}

// ─── API Platform Functions ───────────────────────────────────────────────────

async function postToPlatform(platform: string, post: PostRecord) {
  switch (platform) {
    case "instagram": return await postToInstagram(post);
    case "youtube":   return await postToYouTube(post);
    case "facebook":  return await postToFacebook(post);
    default: throw new Error(`Unknown platform: ${platform}`);
  }
}

async function postToInstagram(post: PostRecord) {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  const igUserId = process.env.INSTAGRAM_USER_ID;
  const containerRes = await fetch(
    `https://graph.instagram.com/v19.0/${igUserId}/media`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        media_type: "REELS",
        video_url: post.clip_url,
        caption: `${post.caption}\n\n${post.hashtags}`,
        access_token: token,
      }),
    }
  );
  const container = await containerRes.json();
  if (!containerRes.ok) throw new Error(`IG error: ${container.error?.message}`);
  const publishRes = await fetch(
    `https://graph.instagram.com/v19.0/${igUserId}/media_publish`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creation_id: container.id, access_token: token }),
    }
  );
  if (!publishRes.ok) throw new Error(`IG publish error: ${publishRes.statusText}`);
  return await publishRes.json();
}

async function postToYouTube(post: PostRecord) {
  const token = process.env.YOUTUBE_ACCESS_TOKEN;
  const response = await fetch(
    "https://www.googleapis.com/upload/youtube/v3/videos?part=snippet,status&uploadType=resumable",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        snippet: {
          title: post.caption.substring(0, 100),
          description: `${post.caption}\n\n${post.hashtags}`,
          tags: post.hashtags.replace(/#/g, "").split(" "),
          categoryId: "22",
        },
        status: { privacyStatus: "public", selfDeclaredMadeForKids: false },
      }),
    }
  );
  if (!response.ok) throw new Error(`YouTube error: ${response.statusText}`);
  return { uploadUrl: response.headers.get("Location") };
}

async function postToFacebook(post: PostRecord) {
  const token = process.env.FACEBOOK_PAGE_TOKEN;
  const pageId = process.env.FACEBOOK_PAGE_ID;
  const response = await fetch(
    `https://graph.facebook.com/v19.0/${pageId}/videos`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file_url: post.clip_url,
        description: `${post.caption}\n\n${post.hashtags}`,
        access_token: token,
        published: true,
      }),
    }
  );
  if (!response.ok) throw new Error(`Facebook error: ${response.statusText}`);
  return await response.json();
}