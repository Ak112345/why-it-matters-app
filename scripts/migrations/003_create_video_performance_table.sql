-- Migration: Create video_performance table for analytics tracking
-- Purpose: Records platform performance metrics for published videos
-- Status: Aggregates views, engagement, and conversion data

DROP TABLE IF EXISTS video_performance CASCADE;

CREATE TABLE video_performance (
  id BIGSERIAL PRIMARY KEY,
  video_id UUID NOT NULL REFERENCES video_final(id) ON DELETE CASCADE,
  
  -- Platform and Timing
  platform VARCHAR(100) NOT NULL,
  posted_at TIMESTAMP,
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Core Metrics
  views INT DEFAULT 0,
  engagement_count INT DEFAULT 0,
  shares INT DEFAULT 0,
  likes INT DEFAULT 0,
  comments INT DEFAULT 0,
  watch_time_minutes INT DEFAULT 0,
  
  -- Calculated Metrics
  engagement_rate DECIMAL(5,2),
  estimated_reach INT,
  estimated_impressions INT,
  avg_watch_percentage DECIMAL(5,2),
  
  -- Conversion & Impact
  click_throughs INT DEFAULT 0,
  conversions INT DEFAULT 0,
  estimated_impact_score DECIMAL(5,2),
  
  -- Metadata
  metrics_json JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CHECK (platform IN ('tiktok', 'instagram', 'youtube', 'twitter', 'linkedin', 'facebook', 'threads')),
  CHECK (engagement_rate IS NULL OR (engagement_rate >= 0 AND engagement_rate <= 100)),
  CHECK (avg_watch_percentage IS NULL OR (avg_watch_percentage >= 0 AND avg_watch_percentage <= 100)),
  CHECK (views >= 0 AND engagement_count >= 0 AND shares >= 0)
);

-- Index for weekly/monthly aggregation queries
CREATE INDEX idx_video_performance_recorded_at 
ON video_performance(recorded_at DESC);

-- Index for platform-specific analytics
CREATE INDEX idx_video_performance_platform 
ON video_performance(platform, recorded_at DESC);

-- Index for video performance tracking
CREATE INDEX idx_video_performance_video_id 
ON video_performance(video_id, recorded_at DESC);

-- Index for high-engagement queries (re-promotion candidates)
CREATE INDEX idx_video_performance_engagement_rate 
ON video_performance(engagement_rate DESC) 
WHERE engagement_rate > 5.0;
