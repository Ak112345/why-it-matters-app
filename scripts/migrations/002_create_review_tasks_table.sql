-- Migration: Create review_tasks table for editorial workflow
-- Purpose: Manages editorial review workflow for content flagged for human review
-- Status: Tracks assignment, review stages, and editorial decisions

DROP TABLE IF EXISTS review_tasks CASCADE;

CREATE TABLE review_tasks (
  id BIGSERIAL PRIMARY KEY,
  clip_id UUID NOT NULL REFERENCES clips_raw(id) ON DELETE CASCADE,
  
  -- Workflow Stages
  stage VARCHAR(50) NOT NULL DEFAULT 'pending',
  priority VARCHAR(20) NOT NULL DEFAULT 'normal',
  
  -- Content Issues
  issues JSONB NOT NULL DEFAULT '[]'::jsonb,
  issues_summary TEXT,
  
  -- Assignment and Review
  assigned_to VARCHAR(100),
  assigned_at TIMESTAMP,
  review_started_at TIMESTAMP,
  
  -- Editorial Decision
  feedback TEXT,
  decision VARCHAR(50),
  decided_by VARCHAR(100),
  decided_at TIMESTAMP,
  revision_count INT DEFAULT 0,
  revision_requested_reason TEXT,
  
  -- Metadata
  estimated_review_time INT DEFAULT 30,
  actual_review_time_minutes INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CHECK (stage IN ('pending', 'in_review', 'approved', 'revision_requested', 'archived')),
  CHECK (priority IN ('low', 'normal', 'high', 'critical')),
  CHECK (decision IS NULL OR decision IN ('approved', 'rejected', 'revision_requested')),
  CHECK (revision_count <= 2)
);

-- Index for editor workflow (find assigned tasks)
CREATE INDEX idx_review_tasks_assigned_to_stage 
ON review_tasks(assigned_to, stage) 
WHERE assigned_to IS NOT NULL AND stage != 'archived';

-- Index for pending tasks
CREATE INDEX idx_review_tasks_pending 
ON review_tasks(priority DESC, created_at ASC) 
WHERE stage IN ('pending', 'in_review');

-- Index for priority filtering
CREATE INDEX idx_review_tasks_priority 
ON review_tasks(priority DESC) 
WHERE stage != 'archived';

-- Index for clip tracking
CREATE INDEX idx_review_tasks_clip_id 
ON review_tasks(clip_id) 
WHERE stage != 'archived';
