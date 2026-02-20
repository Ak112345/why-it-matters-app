-- Auto-Remediation System Tables
-- Run this in Supabase SQL Editor to enable error detection & auto-recovery

-- Remediation Log: Track all auto-fix attempts
CREATE TABLE IF NOT EXISTS remediation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  error_type TEXT NOT NULL, -- 'publish_failed', 'upload_stuck', 'analysis_failed', etc.
  entity_id TEXT NOT NULL, -- ID of the affected video/clip/segment
  entity_name TEXT NOT NULL, -- Human-readable name for dashboard display
  error_message TEXT NOT NULL,
  remediation_action TEXT NOT NULL, -- 'scheduled_retry', 'caption_sanitized', etc.
  remediation_success BOOLEAN NOT NULL,
  remediation_details TEXT,
  retry_recommended BOOLEAN DEFAULT false,
  manual_trigger BOOLEAN DEFAULT false, -- true if triggered via dashboard
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- System Alerts: Critical issues requiring admin attention
CREATE TABLE IF NOT EXISTS system_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL, -- 'credential_issue', 'quota_exceeded', 'service_down', etc.
  platform TEXT, -- 'facebook', 'youtube', 'instagram', etc.
  message TEXT NOT NULL,
  severity TEXT DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
  acknowledged BOOLEAN DEFAULT false,
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  acknowledged_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Error Log: Detailed error records needing human review
CREATE TABLE IF NOT EXISTS error_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  error_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  entity_name TEXT NOT NULL,
  error_message TEXT NOT NULL,
  ai_analysis JSONB, -- Full AI analysis response
  status TEXT DEFAULT 'needs_human_review', -- 'needs_human_review', 'in_progress', 'resolved', 'wont_fix'
  assigned_to TEXT,
  resolution_notes TEXT,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add production_settings column to videos_final if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'videos_final' AND column_name = 'production_settings'
  ) THEN
    ALTER TABLE videos_final ADD COLUMN production_settings JSONB;
  END IF;
END $$;

-- Add error_message column to videos_final if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'videos_final' AND column_name = 'error_message'
  ) THEN
    ALTER TABLE videos_final ADD COLUMN error_message TEXT;
  END IF;
END $$;

-- Add error_message column to clips_segmented if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'clips_segmented' AND column_name = 'error_message'
  ) THEN
    ALTER TABLE clips_segmented ADD COLUMN error_message TEXT;
  END IF;
END $$;

-- Add metadata column to posting_queue if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'posting_queue' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE posting_queue ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_remediation_log_created_at ON remediation_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_remediation_log_entity_id ON remediation_log(entity_id);
CREATE INDEX IF NOT EXISTS idx_system_alerts_acknowledged ON system_alerts(acknowledged, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_log_status ON error_log(status, created_at DESC);

-- Enable Row Level Security (optional, for production)
-- ALTER TABLE remediation_log ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE system_alerts ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE error_log ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE remediation_log IS 'Tracks all automatic error remediation attempts by the AI agent';
COMMENT ON TABLE system_alerts IS 'Critical system issues requiring administrator attention';
COMMENT ON TABLE error_log IS 'Detailed error records that need human review and resolution';
