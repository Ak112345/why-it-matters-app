import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const API_PLATFORMS = ["instagram", "youtube", "facebook"];

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
  tiktok_caption?: string;
  tiktok_hashtags?: string;
}

Deno.serve(async (req) => {
  try {
    const authHeader = req.headers.get("Authorization");
    const cronSecret = Deno.env.get("CRON_SECRET");
    if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const source = body.source ?? "cron";

    const { data: posts, error: fetchError } = await supabase
      .from("posts")
      .select("*")
      .eq("status", "queued")
      .lte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(1);

    if (fetchError) throw fetchError;

    if (!posts || posts.length === 0) {
      return new Response(
        JSON.stringify({ message: "No posts queued", posted: 0 }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    const post: PostRecord = posts[0];

    await supabase
      .from("posts")
      .update({ status: "posting", updated_at: new Date().toISOString() })
      .eq("id", post.id);

    const results: Record<string, { success: boolean; error?: string; detail?: unknown }> = {};

    const apiTargets = post.platforms.filter((p) => API_PLATFORMS.includes(p));
    for (const platform of apiTargets) {
      try {
        const result = await postToPlatform(platform, post);
        results[platform] = { success: true, detail: result };
      } catch (err) {
        results[platform] = { success: false, error: String(err) };
      }
    }

    if (post.platforms.includes("tiktok")) {
      try {
        await queueTikTokBatch(supabase, post);
        results["tiktok"] = { success: true, detail: "Added to tiktok-batch bucket" };
      } catch (err) {
        results["tiktok"] = { success: false, error: String(err) };
      }
    }

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

    return new Response(
      JSON.stringify({ message: `Post ${finalStatus}`, post_id: post.id, results }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Auto-post error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

async function queueTikTokBatch(supabase: ReturnType<typeof createClient>, post: PostRecord) {
  const today = new Date().toISOString().split("T")[0];
  const caption = post.tiktok_caption ?? post.caption;
  const hashtags = post.tiktok_hashtags ?? post.hashtags;
  const suggestedTimes = [
    "7:00 AM EST  (12:00 UTC) - Morning commute scroll",
    "12:00 PM EST (17:00 UTC) - Lunch break scroll",
    "7:00 PM EST  (00:00 UTC) - Prime evening time",
  ];
  const txtContent = [
    `POST ID: ${post.id}`,
    `DATE: ${today}`,
    `CAPTION: ${caption}`,
    `HASHTAGS: ${hashtags}`,
    `SUGGESTED TIMES:`,
    ...suggestedTimes,
    `VIDEO URL: ${post.clip_url}`,
  ].join("\n");

  const txtPath = `${today}/${post.id}.txt`;
  const { error: txtError } = await supabase.storage
    .from("tiktok-batch")
    .upload(txtPath, new Blob([txtContent], { type: "text/plain" }), { upsert: true });
  if (txtError) throw new Error(`TXT upload failed: ${txtError.message}`);

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

async function postToPlatform(platform: string, post: PostRecord) {
  switch (platform) {
    case "instagram": return await postToInstagram(post);
    case "youtube":   return await postToYouTube(post);
    case "facebook":  return await postToFacebook(post);
    default: throw new Error(`Unknown platform: ${platform}`);
  }
}

async function postToInstagram(post: PostRecord) {
  const token = Deno.env.get("INSTAGRAM_ACCESS_TOKEN");
  const igUserId = Deno.env.get("INSTAGRAM_USER_ID");
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
  const token = Deno.env.get("YOUTUBE_ACCESS_TOKEN");
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
  const token = Deno.env.get("FACEBOOK_PAGE_TOKEN");
  const pageId = Deno.env.get("FACEBOOK_PAGE_ID");
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
