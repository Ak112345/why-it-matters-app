// This worker processes pending analysis rows and triggers content production and posting.
// Schedule this script to run every few minutes (via GitHub Actions, Vercel Cron, or another scheduler).

// ...existing code...
// ...existing code...

import { createClient } from '@supabase/supabase-js';

let produceVideo: any, queueVideos: any, publishVideo: any;
({ produceVideo } = await import('../src/production/produceVideo'));
({ queueVideos } = await import('../src/distribution/queueVideos'));
({ publishVideo } = await import('../src/distribution/publishVideo'));


const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.NEXT_SUPABASE_SERVICE_ROLE_SECRET_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_URL or NEXT_SUPABASE_SERVICE_ROLE_SECRET_KEY environment variable.');
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function processPendingAnalysis() {
  // Fetch pending analysis rows
  const { data: pending, error } = await supabase
    .from('analysis')
    .select('*')
    .eq('status', 'pending')
    .limit(10);

  if (error) {
    console.error('Error fetching pending analysis:', error);
    return;
  }

  for (const row of pending) {
    try {
      // Produce video(s) for this analysis row
      const producedVideos = await produceVideo({ analysisId: row.id });
      for (const video of producedVideos) {
        // Queue video(s) for posting
        const queueResults = await queueVideos({ videoId: video.videoId });
        for (const queueResult of queueResults) {
          // Publish video(s)
          // Only use valid platforms for publishVideo
          for (let i = 0; i < queueResult.queueIds.length; i++) {
            const queueId = queueResult.queueIds[i];
            const platform = queueResult.platforms[i] as 'instagram' | 'youtube_shorts' | undefined;
            if (!platform) continue;
            const publishResults = await publishVideo({ queueId, platform });
            for (const publishResult of publishResults) {
              // Update analysis status
              await supabase
                .from('analysis')
                .update({ status: 'completed' })
                .eq('id', row.id);
              // Log success
              console.log(`Processed analysis ${row.id}: posted to ${publishResult.platform}`);
            }
          }
        }
      }
    } catch (err) {
      // Log and update error
      console.error(`Error processing analysis ${row.id}:`, err);
      await supabase
        .from('analysis')
        .update({ status: 'failed', error_message: String(err) })
        .eq('id', row.id);
    }
  }
}

processPendingAnalysis();
