import { createClient } from "@supabase/supabase-js";
import type { NextApiRequest, NextApiResponse } from "next";

// Node.js/Next.js compatible handler
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const auth = req.headers["authorization"] || "";
  const CRON_SECRET = process.env.CRON_SECRET as string;
  const SUPABASE_URL = process.env.SUPABASE_URL as string;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

  const expected = `Bearer ${CRON_SECRET}`;
  if (!CRON_SECRET || auth !== expected) {
    res.status(401).send("Unauthorized");
    return;
  }

  const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY
  );

  const targetDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const { data: batchItems, error } = await supabase
    .from("tiktok_batch")
    .select("*")
    .eq("batch_date", targetDate)
    .eq("status", "ready")
    .order("created_at", { ascending: true });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  if (!batchItems || batchItems.length === 0) {
    res.status(200).json({ message: "No batch items" });
    return;
  }

  const csvHeaders = [
    "Post ID",
    "Video File",
    "Caption",
    "Hashtags",
    "Suggested Time 1",
    "Suggested Time 2",
    "Suggested Time 3",
    "Video URL",
    "Status",
  ].join(",");

  const csvRows = batchItems.map((item) => {
    const times = item.suggested_times || [];
    return [
      `"${item.post_id}"`,
      `"${item.post_id}.mp4"`,
      `"${(item.caption || "").replace(/"/g, '""')}"`,
      `"${(item.hashtags || "").replace(/"/g, '""')}"`,
      `"${times[0] || ""}"`,
      `"${times[1] || ""}"`,
      `"${times[2] || ""}"`,
      `"${item.clip_url}"`,
      `"${item.status}"`,
    ].join(",");
  });

  const csvContent = [csvHeaders, ...csvRows].join("\n");
  const manifestPath = `${targetDate}/MANIFEST-${targetDate}.csv`;

  const { error: uploadError } = await supabase.storage
    .from("tiktok-batch")
    .upload(
      manifestPath,
      new Blob([csvContent], { type: "text/csv" }),
      { upsert: true }
    );

  if (uploadError) {
    res.status(500).json({ error: uploadError.message });
    return;
  }

  res.status(200).json({
    message: "Manifest generated",
    items: batchItems.length,
    manifest_path: manifestPath,
  });
}