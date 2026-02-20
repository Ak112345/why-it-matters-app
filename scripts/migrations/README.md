# Database Migrations

This directory contains SQL migration scripts for the content management system.

## Migration Files

| File | Purpose | Tables |
|------|---------|--------|
| `001_create_content_direction_table.sql` | Director approval tracking and quality scoring | `content_direction` |
| `002_create_review_tasks_table.sql` | Editorial review workflow management | `review_tasks` |
| `003_create_video_performance_table.sql` | Platform performance metrics and analytics | `video_performance` |

## How to Apply Migrations

### Option 1: Supabase SQL Editor (Recommended)

1. Go to your Supabase project dashboard
2. Click **SQL Editor** in the left sidebar
3. Click **New Query**
4. Copy the entire contents of each `.sql` file in order (001, 002, 003)
5. Paste into the SQL editor
6. Click **Run**
7. Verify success ("Query executed successfully")

### Option 2: psql Command Line

```bash
# Connect to your Supabase database
psql -U postgres -h your-project.supabase.co -d postgres -W

# Run migrations in order
\i scripts/migrations/001_create_content_direction_table.sql
\i scripts/migrations/002_create_review_tasks_table.sql
\i scripts/migrations/003_create_video_performance_table.sql
```

### Option 3: Supabase CLI

```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Login to your Supabase account
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Run migrations
supabase migration up
```

## Table Schemas

### content_direction
Tracks approval status, quality scores, and director feedback for all content.

**Key Fields:**
- `clip_id` - Reference to the source clip
- `status` - Current stage (ingested → published)
- `approval_level` - Decision type (automatic, editor_review, rejected)
- `quality_score` - Overall quality (0-100)
- `content_pillar` - Content category
- `guidance_for_production` - Director instructions

**Indexes:**
- Approval & status lookup
- Recent content queries
- Content pillar analysis

### review_tasks
Manages editorial review workflow for content flagged for human review (QA score 60-75%).

**Key Fields:**
- `clip_id` - Reference to the content being reviewed
- `stage` - Workflow stage (pending → approved/rejected)
- `assigned_to` - Editor username
- `decision` - Editorial decision (approved/rejected/revision_requested)
- `feedback` - Editor comments
- `revision_count` - Number of revision rounds (max 2)

**Indexes:**
- Editor workflow queries
- Pending task filtering
- Priority-based sorting

### video_performance
Records platform performance metrics for published videos.

**Key Fields:**
- `video_id` - Reference to the published video
- `platform` - Social platform (tiktok, instagram, youtube, etc.)
- `views`, `engagement_count`, `shares`, `likes`, `comments`
- `engagement_rate` - Calculated as (engagement / views) * 100
- `estimated_reach`, `estimated_impact_score`
- `posted_at`, `recorded_at` - Timing metadata

**Indexes:**
- Weekly/monthly aggregation
- Platform-specific analytics
- High-engagement tracking (re-promotion candidates)
- Recent metrics (90-day window)

## Testing the Migrations

After running migrations, verify they were created:

```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('content_direction', 'review_tasks', 'video_performance');

-- Check indexes
SELECT indexname FROM pg_indexes 
WHERE schemaname = 'public' 
AND tablename IN ('content_direction', 'review_tasks', 'video_performance');
```

## Foreign Key Dependencies

- `content_direction.clip_id` → `clips_raw.id`
- `review_tasks.clip_id` → `clips_raw.id`
- `video_performance.video_id` → `video_final.id`

**Note:** These ForeignKey references depend on `clips_raw` and `video_final` tables existing from the ingestion and production pipelines. If they don't exist, you'll encounter errors when trying to create these tables.

## Rollback Instructions

To drop tables (if needed):

```sql
-- Drop in reverse order (respecting foreign key dependencies)
DROP TABLE IF EXISTS video_performance CASCADE;
DROP TABLE IF EXISTS review_tasks CASCADE;
DROP TABLE IF EXISTS content_direction CASCADE;
```

## Additional Setup

After tables are created, you may want to add RLS policies:

```sql
-- Enable Row Level Security
ALTER TABLE content_direction ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_performance ENABLE ROW LEVEL SECURITY;

-- Create policies (example - allow authenticated users to read)
CREATE POLICY "Allow authenticated read" ON content_direction
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated read" ON review_tasks
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated read" ON video_performance
  FOR SELECT USING (auth.role() = 'authenticated');
```

See `/CONTENT_MANAGEMENT_GUIDE.md` for integration details with the application.
