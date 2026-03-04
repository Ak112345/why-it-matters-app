-- Railway posting migration
-- Adds posting state fields and job logs for worker-driven posting

ALTER TABLE IF EXISTS posting_queue
  ADD COLUMN IF NOT EXISTS youtube_video_id TEXT,
  ADD COLUMN IF NOT EXISTS youtube_url TEXT,
  ADD COLUMN IF NOT EXISTS ig_media_id TEXT,
  ADD COLUMN IF NOT EXISTS ig_permalink TEXT,
  ADD COLUMN IF NOT EXISTS fb_post_id TEXT,
  ADD COLUMN IF NOT EXISTS fb_permalink TEXT,
  ADD COLUMN IF NOT EXISTS last_error TEXT,
  ADD COLUMN IF NOT EXISTS posted_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE IF EXISTS posting_queue
  ALTER COLUMN status TYPE TEXT;

ALTER TABLE IF EXISTS posting_queue
  DROP CONSTRAINT IF EXISTS posting_queue_status_check;

ALTER TABLE IF EXISTS posting_queue
  ADD CONSTRAINT posting_queue_status_check
  CHECK (status IN (
    'queued',
    'pending',
    'rendered',
    'posting',
    'posted',
    'posting_youtube',
    'posted_youtube',
    'posting_meta',
    'posted_meta',
    'failed',
    'archived'
  ));

ALTER TABLE IF EXISTS videos_final
  ADD COLUMN IF NOT EXISTS final_video_path TEXT;

CREATE TABLE IF NOT EXISTS job_logs (
  id BIGSERIAL PRIMARY KEY,
  job_id UUID,
  level TEXT NOT NULL DEFAULT 'info',
  event TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_posting_queue_status_updated_at ON posting_queue(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_posting_queue_posted_at ON posting_queue(posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_logs_job_id_created_at ON job_logs(job_id, created_at DESC);
