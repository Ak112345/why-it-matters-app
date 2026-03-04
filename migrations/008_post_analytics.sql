-- Analytics schema for dashboard
-- Railway writes here after posting, dashboard queries from Vercel

CREATE TABLE IF NOT EXISTS post_analytics (
  id BIGSERIAL PRIMARY KEY,
  job_id UUID NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('youtube', 'instagram', 'facebook', 'tiktok')),
  
  -- Platform IDs for cross-referencing
  youtube_video_id TEXT,
  ig_media_id TEXT,
  fb_post_id TEXT,
  tiktok_post_id TEXT,
  
  -- YouTube Shorts metrics
  youtube_views BIGINT DEFAULT 0,
  youtube_likes BIGINT DEFAULT 0,
  youtube_comments BIGINT DEFAULT 0,
  youtube_shares BIGINT DEFAULT 0,
  youtube_watch_time_minutes BIGINT DEFAULT 0,
  youtube_avg_view_duration_seconds INT DEFAULT 0,
  
  -- Instagram Reels metrics
  ig_impressions BIGINT DEFAULT 0,
  ig_reach BIGINT DEFAULT 0,
  ig_likes BIGINT DEFAULT 0,
  ig_comments BIGINT DEFAULT 0,
  ig_shares BIGINT DEFAULT 0,
  ig_saves BIGINT DEFAULT 0,
  
  -- Facebook video metrics
  fb_views BIGINT DEFAULT 0,
  fb_likes BIGINT DEFAULT 0,
  fb_comments BIGINT DEFAULT 0,
  fb_shares BIGINT DEFAULT 0,
  fb_reach BIGINT DEFAULT 0,
  
  -- Engagement calculations (denormalized for dashboard speed)
  total_views BIGINT DEFAULT 0,
  total_engagements BIGINT DEFAULT 0,
  engagement_rate NUMERIC(5,2) DEFAULT 0, -- percentage
  
  -- Timestamps
  posted_at TIMESTAMP WITH TIME ZONE,
  stats_fetched_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Index for dashboard queries
CREATE INDEX IF NOT EXISTS idx_post_analytics_platform_posted ON post_analytics(platform, posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_analytics_job_id ON post_analytics(job_id);
CREATE INDEX IF NOT EXISTS idx_post_analytics_total_views ON post_analytics(total_views DESC);
CREATE INDEX IF NOT EXISTS idx_post_analytics_engagement_rate ON post_analytics(engagement_rate DESC);
CREATE INDEX IF NOT EXISTS idx_post_analytics_stats_fetched_at ON post_analytics(stats_fetched_at DESC);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_post_analytics_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS post_analytics_timestamp ON post_analytics;
CREATE TRIGGER post_analytics_timestamp
  BEFORE UPDATE ON post_analytics
  FOR EACH ROW
  EXECUTE FUNCTION update_post_analytics_timestamp();

-- Aggregate view for dashboard rankings
CREATE OR REPLACE VIEW top_performing_posts AS
SELECT
  id,
  job_id,
  platform,
  youtube_video_id,
  ig_media_id,
  fb_post_id,
  total_views,
  total_engagements,
  engagement_rate,
  posted_at,
  stats_fetched_at,
  RANK() OVER (ORDER BY total_views DESC) as views_rank,
  RANK() OVER (ORDER BY engagement_rate DESC) as engagement_rank
FROM post_analytics
WHERE stats_fetched_at IS NOT NULL
ORDER BY posted_at DESC;

COMMENT ON TABLE post_analytics IS 'Platform-agnostic analytics synced from YouTube/Meta/TikTok by Railway worker';
COMMENT ON VIEW top_performing_posts IS 'Ranked view for dashboard to find best-performing posts';
