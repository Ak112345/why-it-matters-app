-- Migration 006: Add times_posted tracking to prevent excessive reuse of videos
-- This tracks how many times each video has been posted across platforms

ALTER TABLE videos_final
ADD COLUMN IF NOT EXISTS times_posted INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_posted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Create index for better performance when filtering posted videos
CREATE INDEX IF NOT EXISTS idx_videos_final_times_posted ON videos_final(times_posted);
CREATE INDEX IF NOT EXISTS idx_videos_final_last_posted ON videos_final(last_posted_at DESC);

-- Update comment/description
COMMENT ON COLUMN videos_final.times_posted IS 'Number of times this video has been posted successfully across all platforms';
COMMENT ON COLUMN videos_final.last_posted_at IS 'Timestamp of the most recent successful posting';
