-- Migration: Create content_direction table for director approval tracking
-- Purpose: Tracks approval status, quality scores, and director feedback for all content
-- Status: One row per analyzed segment/clip

DROP TABLE IF EXISTS content_direction CASCADE;

CREATE TABLE content_direction (
  id BIGSERIAL PRIMARY KEY,
  clip_id UUID NOT NULL REFERENCES clips_raw(id) ON DELETE CASCADE,
  
  -- Status and Approval
  status VARCHAR(50) NOT NULL DEFAULT 'ingested',
  approval_level VARCHAR(50) NOT NULL DEFAULT 'pending',
  
  -- Quality Scoring
  quality_score DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  hook_strength DECIMAL(3,1),
  caption_clarity DECIMAL(3,1),
  content_relevance DECIMAL(3,1),
  sensationalism_score DECIMAL(3,1),
  brand_alignment_score DECIMAL(3,1),
  
  -- Director Routing
  content_pillar VARCHAR(100),
  virality_score DECIMAL(5,2),
  guidance_for_production TEXT,
  validation_details JSONB,
  
  -- Metadata
  director_notes TEXT,
  created_by VARCHAR(100) DEFAULT 'system',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CHECK (quality_score >= 0 AND quality_score <= 100),
  CHECK (approval_level IN ('pending', 'automatic', 'editor_review', 'rejected')),
  CHECK (status IN ('ingested', 'segmented', 'analyzed', 'qa_pending', 'approved', 'rejected', 'produced', 'queued', 'published', 'archived'))
);

-- Index for quick lookups by approval level and status
CREATE INDEX idx_content_direction_approval_status 
ON content_direction(approval_level, status);

-- Index for director workflow querying
CREATE INDEX idx_content_direction_created_at 
ON content_direction(created_at DESC);

-- Index for content pillar analysis
CREATE INDEX idx_content_direction_pillar 
ON content_direction(content_pillar) 
WHERE status != 'archived';
