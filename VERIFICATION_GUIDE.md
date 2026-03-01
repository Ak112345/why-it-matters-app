# Pipeline Verification Guide

This guide explains how to verify the health of your clip processing pipeline without timing out in Codespaces or other resource-constrained environments.

## Quick Start

```bash
# Verify segment count and clip IDs
pnpm verify:segments

# Full pipeline diagnostics
pnpm diagnose:pipeline
```

## Verification Scripts

### 1. Segment ID Verification (`list-segment-ids.ts`)

Standalone script that checks availability of segmented clip IDs in the database with safe pagination and timeouts.

**No build step required** - this script runs directly with ts-node.

**Usage:**
```bash
pnpm verify:segments
```

**Advanced usage:**
```bash
# Print every segment ID (use with caution on large datasets)
pnpm verify:segments -- --all

# Custom limits via environment variables
SEGMENT_LIST_MAX_ROWS=500 SEGMENT_LIST_PAGE_SIZE=100 pnpm verify:segments
```

**Environment variables:**
- `SEGMENT_LIST_PAGE_SIZE` - Records per page (default: 200)
- `SEGMENT_LIST_MAX_ROWS` - Maximum total rows to fetch (default: 1000)
- `SEGMENT_LIST_TIMEOUT_MS` - Query timeout in milliseconds (default: 15000)

**What it does:**
- Fetches segment IDs in pages to avoid memory overflow
- Reports total count vs. fetched count
- Enforces timeout on each query to prevent hangs
- Summarizes results without printing every ID by default

### 2. Pipeline Health Diagnostics (`diagnose-pipeline.ts`)

Standalone script that performs comprehensive checks of all pipeline stages: raw clips, segments, analyses, and videos.

**No build step required** - this script runs directly with ts-node.

**Usage:**
```bash
pnpm diagnose:pipeline
```

**Environment variables:**
- `DIAGNOSE_QUERY_LIMIT` - Max records per query (default: 300)
- `DIAGNOSE_TIMEOUT_MS` - Query timeout in milliseconds (default: 20000)

**What it checks:**
- Raw clips by status and source
- Segmented clips with metadata and relationships
- Analysis records (real vs. placeholder)
- Final videos by status
- Foreign key relationships between clips_segmented and clips_raw
- Provides actionable diagnosis and next steps

**Sample output:**
```
🔍 Diagnosing Pipeline Status...
Using query limit=300, timeout=20000ms

📦 Checking raw clips...
  Total: 250
  By status: { new: 30, processing: 10, segmented: 210 }

📐 Checking segments...
  Total: 527
  By status: { new: 200, analyzed: 327 }
  With raw_clip_id: 527/527

📊 SUMMARY:
  Raw clips: 250
  Segments: 527
  Analyses: 327 (300 real)
  Videos: 45

🔍 DIAGNOSIS:
  ✅ 227 segments ready for analysis
     → Run: curl "https://your-app.vercel.app/api/analyze?batchSize=20"
```

## Troubleshooting

### Timeout Issues

If verification still times out in your Codespace:

1. **Reduce query limits:**
   ```bash
   DIAGNOSE_QUERY_LIMIT=50 DIAGNOSE_TIMEOUT_MS=10000 pnpm diagnose:pipeline
   ```

2. **Check segment count only:**
   ```bash
   SEGMENT_LIST_MAX_ROWS=10 pnpm verify:segments
   ```

3. **Use direct SQL queries** in the Supabase dashboard for large inspections.

### Database Connection Issues

Both scripts are standalone and require Supabase credentials in `.env.local`:

```env
SUPABASE_URL=https://your-project.supabase.co
NEXT_SUPABASE_SERVICE_ROLE_SECRET_KEY=your-service-role-key
```

## Best Practices

1. **Start small:** Use low limits first, then increase if your environment handles it well.
2. **Monitor resource usage:** Watch CPU and memory in Codespaces during verification.
3. **Use targeted checks:** If one stage is slow, query that table directly with SQL.
4. **Schedule carefully:** Avoid running full diagnostics during active processing.

## Integration with CI/CD

These scripts can run in GitHub Actions or cron jobs:

```yaml
- name: Verify pipeline health
  run: |
    DIAGNOSE_QUERY_LIMIT=100 pnpm diagnose:pipeline
```

Keep limits low in CI environments to avoid timeout failures.
