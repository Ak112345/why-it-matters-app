# Analytics System Implementation Guide

## Overview
This implementation ensures the dashboard stays updated with posting analytics after migration to Railway worker. Railway fetches stats from YouTube/Meta APIs and syncs them to Supabase. Vercel dashboard queries Supabase only (no platform tokens required).

## Architecture
```
┌─────────────┐         ┌──────────────┐         ┌───────────────┐
│   Railway   │         │   Supabase   │         │    Vercel     │
│   Worker    │────────▶│ post_analytics│◀────────│   Dashboard   │
│             │  writes │    table     │  reads  │               │
└─────────────┘         └──────────────┘         └───────────────┘
      │                                                    
      │ fetches stats via APIs
      ▼
┌────────────────────────┐
│ YouTube/Meta Platforms │
└────────────────────────┘
```

## Implementation Steps

### 1. Deploy Analytics Migration ✅

**FILE:** `/migrations/008_post_analytics.sql`

**To deploy:**
1. Open your Supabase dashboard → SQL Editor
2. Copy the entire contents of `migrations/008_post_analytics.sql`
3. Run the SQL

**Alternatively via code:**
```bash
node scripts/deploy-analytics.mjs
# Or manually via psql if available:
psql "$DATABASE_URL" < migrations/008_post_analytics.sql
```

**What it creates:**
- `post_analytics` table with metrics for YouTube/Instagram/Facebook
- Indexes for fast dashboard queries on (platform, posted_at), (total_views DESC), (engagement_rate DESC)
- `top_performing_posts` view with RANK() for rankings
- Auto-update trigger for `updated_at` timestamp

### 2. Railway Worker Analytics Fetchers ✅

**FILE:** `/railway-worker/src/index.ts`

**Implemented functions:**

#### `fetchYouTubeStats(videoId, accessToken)`
- Calls YouTube Data API v3 `/videos?part=statistics`
- Returns: `{ views, likes, comments }`
- Uses existing `getYouTubeAccessToken()` for runtime token refresh

#### `fetchInstagramStats(mediaId, accessToken)`  
- Calls Instagram Graph API `/v19.0/{mediaId}?fields=insights.metric(...)`
- Returns: `{ impressions, reach, likes, comments, shares, saves }`
- Uses `FACEBOOK_PAGE_ACCESS_TOKEN` from env

#### `fetchFacebookStats(postId, accessToken)`
- Calls Facebook Graph API `/v19.0/{postId}?fields=shares,likes,comments,insights`
- Returns: `{ views, likes, comments, shares, reach }`
- Uses `FACEBOOK_PAGE_ACCESS_TOKEN` from env

#### `syncPostAnalytics(jobId)`
- Fetches job from posting_queue
- Calls appropriate stats fetcher based on platform
- Calculates `total_views`, `total_engagements`, `engagement_rate`
- Upserts into `post_analytics` table on conflict (job_id)
- Logs to `job_logs` table

**Auto-sync on post success:**
- After YouTube post: `syncPostAnalytics(jobId)` called (non-blocking)
- After Meta post: `syncPostAnalytics(jobId)` called (non-blocking)
- Errors in analytics sync don't block posting completion

### 3. Periodic Stats Refresh Endpoint ✅

**ENDPOINT:** `POST https://railway-worker-url/stats/refresh`

**Authentication:** Requires `x-worker-secret` header

**Request Body:**
```json
{
  "hoursOld": 2,    // Only sync posts not synced in last N hours
  "daysBack": 7     // Only sync posts posted in last N days
}
```

**Response:**
```json
{
  "success": true,
  "refreshed": 5,
  "failed": 0,
  "jobsProcessed": 5,
  "failedIds": []
}
```

**How it works:**
- Finds jobs with status `posted_youtube` or `posted_meta`
- Filters: posted in last `daysBack` days, not synced in last `hoursOld` hours
- Calls `syncPostAnalytics(jobId)` for each
- Returns count of refreshed/failed

**Usage:**
```bash
curl -X POST https://railway-worker-url/stats/refresh \
  -H "x-worker-secret: $WORKER_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"hoursOld": 2, "daysBack": 7}'
```

**Recommended:** Set up Vercel Cron or Railway native cron to call this every 2 hours:
```typescript
// app/api/cron/refresh-stats/route.ts
export async function GET(req: Request) {
  const res = await fetch(`${process.env.RAILWAY_WORKER_URL}/stats/refresh`, {
    method: 'POST',
    headers: {
      'x-worker-secret': process.env.WORKER_SECRET!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ hoursOld: 2, daysBack: 7 }),
  });
  return Response.json(await res.json());
}
```

### 4. Vercel Analytics Endpoints ✅

#### A. Top Posts
**ENDPOINT:** `GET /api/analytics/top`

**Query Params:**
- `limit` (default 10): number of posts to return
- `platform` (optional): filter by 'youtube' | 'instagram' | 'facebook'
- `sortBy` (default 'total_views'): 'total_views' | 'engagement_rate'

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "job_id": "uuid",
      "platform": "youtube",
      "total_views": 12500,
      "total_engagements": 850,
      "engagement_rate": 6.8,
      "posted_at": "2025-01-15T10:00:00Z"
    }
  ],
  "count": 10
}
```

#### B. By Platform
**ENDPOINT:** `GET /api/analytics/by-platform`

**Query Params:**
- `daysBack` (default 30): how far back to aggregate

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "platform": "youtube",
      "count": 15,
      "total_views": 125000,
      "total_engagements": 8500,
      "avg_engagement_rate": 6.8
    }
  ],
  "daysBack": 30
}
```

#### C. Timeline
**ENDPOINT:** `GET /api/analytics/timeline`

**Query Params:**
- `daysBack` (default 30): timeline range
- `platform` (optional): filter by platform

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "date": "2025-01-15",
      "count": 3,
      "views": 12500,
      "engagements": 850
    }
  ],
  "daysBack": 30,
  "platform": "all"
}
```

## Testing

### 1. Test YouTube Posting with Analytics
```bash
curl -X POST https://railway-worker-url/youtube/post \
  -H "x-worker-secret: $WORKER_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"jobId": "your-job-uuid"}'
```

**Expected:**
- Job status → `posted_youtube`
- `youtube_video_id` saved in posting_queue
- `post_analytics` row created with initial stats (may be 0 initially)
- `job_logs` entry: `analytics_synced`

### 2. Verify Analytics Sync
```sql
SELECT * FROM post_analytics WHERE job_id = 'your-job-uuid';
```

**Expected columns:**
- `youtube_video_id` populated
- `youtube_views`, `youtube_likes`, `youtube_comments` (may be 0 for new posts)
- `stats_fetched_at` timestamp

### 3. Test Stats Refresh
```bash
curl -X POST https://railway-worker-url/stats/refresh \
  -H "x-worker-secret: $WORKER_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"hoursOld": 24, "daysBack": 7}'
```

**Expected:**
- Response: `{ refreshed: N, failed: 0, ... }`
- Updated `youtube_views` for videos that gained views

### 4. Test Dashboard Endpoints
```bash
# Top posts
curl https://your-vercel-app.vercel.app/api/analytics/top?limit=5

# By platform
curl https://your-vercel-app.vercel.app/api/analytics/by-platform?daysBack=7

# Timeline
curl https://your-vercel-app.vercel.app/api/analytics/timeline?daysBack=14&platform=youtube
```

## Environment Variables

### Railway Worker
```env
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...
YOUTUBE_REFRESH_TOKEN=1//xxx
FACEBOOK_PAGE_ACCESS_TOKEN=EAAxx...
WORKER_SECRET=your-secret-key
```

### Vercel
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...
RAILWAY_WORKER_URL=https://railway-worker.railway.app
WORKER_SECRET=your-secret-key
```

**Note:** Vercel does NOT need YouTube/Meta tokens. Dashboard queries Supabase only.

## API Rate Limits & Best Practices

### YouTube Data API v3
- Quota: 10,000 units/day (default)
- 1 video stats request = 1 unit
- Recommendation: Sync every 2 hours for recent posts (last 7 days)

### Meta Graph API
- Rate limit: 200 calls/hour/user (default)
- Instagram insights available 24 hours after posting
- Recommendation: First sync 24 hours after posting, then every 12 hours

### Optimization Strategy
1. **Initial sync:** Triggered immediately after posting (may show 0 for new posts)
2. **First update:** 24 hours post-publish (when Instagram insights available)
3. **Active tracking:** Every 2 hours for posts < 7 days old
4. **Archive tracking:** Every 24 hours for posts 7-30 days old
5. **Historical:** Stop syncing posts > 30 days old

**Adjust in cron:**
```json
{
  "hoursOld": 2,      // Sync if not updated in 2 hours
  "daysBack": 7       // Only sync posts from last 7 days
}
```

## Troubleshooting

### Stats show 0 for new posts
**Cause:** YouTube/Instagram need time to process views  
**Solution:** Wait 1 hour, run refresh endpoint manually

### Analytics sync failed
**Check:**
1. Railway logs: `job_logs` table event = 'analytics_sync_failed'
2. Token validity: YouTube refresh token, Meta page token
3. Video ID exists: `youtube_video_id` populated in posting_queue

**Manual fix:**
```bash
curl -X POST https://railway-worker-url/stats/refresh \
  -H "x-worker-secret: $WORKER_SECRET" \
  -d '{"hoursOld": 999, "daysBack": 1}'  # Force re-sync recent posts
```

### Dashboard shows no data
**Check:**
1. Migration deployed: `SELECT * FROM post_analytics LIMIT 1;`
2. Posts exist: `SELECT COUNT(*) FROM posting_queue WHERE status LIKE 'posted_%';`
3. Vercel env vars: `SUPABASE_SERVICE_ROLE_KEY` set

## Next Steps

1. **Deploy migration:** Run `008_post_analytics.sql` in Supabase SQL Editor
2. **Test YouTube posting:** Trigger a post and verify analytics row created
3. **Set up cron:** Create `/api/cron/refresh-stats` endpoint calling Railway `/stats/refresh`
4. **Monitor logs:** Check Railway console and `job_logs` table for errors
5. **Build dashboard UI:** Create React components that call `/api/analytics/*` endpoints

## Files Changed

### Railway Worker
- `/railway-worker/src/index.ts` (analytics fetchers, sync logic, refresh endpoint)

### Vercel API
- `/app/api/analytics/top/route.ts` (new)
- `/app/api/analytics/by-platform/route.ts` (new)
- `/app/api/analytics/timeline/route.ts` (new)

### Migrations
- `/migrations/008_post_analytics.sql` (new)

### Scripts
- `/scripts/deploy-analytics.mjs` (new, optional helper)

## Support
For issues, check:
- Railway logs: railway logs --follow
- Job logs: `SELECT * FROM job_logs WHERE event LIKE '%analytics%' ORDER BY created_at DESC;`
- Post analytics: `SELECT * FROM post_analytics ORDER BY stats_fetched_at DESC LIMIT 10;`
