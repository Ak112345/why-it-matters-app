# Analytics Implementation Summary

## ✅ What's Been Implemented

### 1. **Database Schema** (`/migrations/008_post_analytics.sql`)
- `post_analytics` table with metrics from YouTube, Instagram, Facebook
- Indexes for fast dashboard queries
- Auto-updating timestamps
- `top_performing_posts` view for rankings

### 2. **Railway Worker Analytics** (`/railway-worker/src/index.ts`)
✅ Stats fetchers:
- `fetchYouTubeStats()` - pulls views/likes/comments from YouTube API
- `fetchInstagramStats()` - pulls impressions/reach/engagement from Instagram
- `fetchFacebookStats()` - pulls views/likes/comments/shares from Facebook

✅ Sync function:
- `syncPostAnalytics(jobId)` - fetches stats and writes to `post_analytics` table

✅ Auto-sync hooks:
- After YouTube posting: analytics synced automatically (non-blocking)
- After Meta posting: analytics synced automatically (non-blocking)

✅ Refresh endpoint:
- `POST /stats/refresh` - bulk refresh analytics for recent posts
- Filters by age (hoursOld, daysBack) to optimize API usage

### 3. **Vercel Dashboard Endpoints**
✅ `/api/analytics/top` - top posts by views or engagement rate
✅ `/api/analytics/by-platform` - platform aggregates (counts, totals, averages)
✅ `/api/analytics/timeline` - daily aggregates for timeline charts

### 4. **Automated Stats Refresh**
✅ `/api/cron/refresh-stats` - Vercel cron that triggers Railway refresh
✅ Added to `vercel.json` - runs every 2 hours
✅ Respects YouTube/Meta API rate limits

## 🚀 Quick Start

### Step 1: Deploy Migration
Open Supabase Dashboard → SQL Editor → Run:
```sql
-- Copy/paste contents of migrations/008_post_analytics.sql
```

### Step 2: Environment Variables (Already Set)
Railway:
- ✅ YOUTUBE_REFRESH_TOKEN
- ✅ FACEBOOK_PAGE_ACCESS_TOKEN
- ✅ SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

Vercel:
- ✅ RAILWAY_WORKER_URL
- ✅ WORKER_SECRET
- ✅ SUPABASE_SERVICE_ROLE_KEY (for analytics queries)

### Step 3: Test the Flow
1. **Post a video** (YouTube only for now):
   ```bash
   curl -X POST /api/publish -d '{"platform":"youtube"}'
   ```

2. **Check analytics synced**:
   ```sql
   SELECT * FROM post_analytics ORDER BY created_at DESC LIMIT 1;
   ```

3. **Query dashboard endpoint**:
   ```bash
   curl https://your-app.vercel.app/api/analytics/top?limit=5
   ```

## 📊 How It Works

```
1. Railway posts video → captures youtube_video_id
                      ↓
2. Railway syncs stats → writes to post_analytics table
                      ↓
3. Vercel cron (every 2h) → triggers Railway /stats/refresh
                      ↓
4. Dashboard queries → /api/analytics/* → reads from Supabase
```

**Key Benefits:**
- ✅ No platform tokens on Vercel (secure)
- ✅ Analytics persist in database (fast queries)
- ✅ Automatic background refresh (always up-to-date)
- ✅ Rate limit optimized (only sync recent posts)

## 📁 Files Created/Modified

### New Files
- `/migrations/008_post_analytics.sql` - Database schema
- `/app/api/analytics/top/route.ts` - Top posts endpoint
- `/app/api/analytics/by-platform/route.ts` - Platform stats endpoint
- `/app/api/analytics/timeline/route.ts` - Timeline endpoint
- `/app/api/cron/refresh-stats/route.ts` - Cron job for refresh
- `/scripts/deploy-analytics.mjs` - Migration helper
- `/ANALYTICS_SETUP.md` - Full documentation

### Modified Files
- `/railway-worker/src/index.ts` - Added analytics fetchers + sync logic
- `/vercel.json` - Added refresh-stats cron (every 2 hours)

## 🔍 Testing Checklist

- [ ] Deploy migration (SQL Editor)
- [ ] Post test video via `/api/publish`
- [ ] Verify `post_analytics` row created
- [ ] Check `youtube_views` populated (may be 0 for new posts)
- [ ] Wait 1 hour, manually trigger `/stats/refresh`
- [ ] Verify `youtube_views` updated
- [ ] Query `/api/analytics/top` - confirm data shows
- [ ] Set up Vercel cron (already in vercel.json)

## 📚 Documentation

See [`ANALYTICS_SETUP.md`](./ANALYTICS_SETUP.md) for:
- Detailed architecture diagrams
- API documentation (all endpoints)
- Rate limit strategies
- Troubleshooting guide
- Advanced configuration

## 🎯 Next Steps

1. **Deploy migration** - Highest priority, unblocks everything else
2. **Test YouTube posting** - Verify auto-sync works
3. **Monitor Railway logs** - Check for analytics_synced events
4. **Build dashboard UI** - Use `/api/analytics/*` endpoints
5. **Enable Meta posting** - Once YouTube stable, uncomment Meta code

## ⚠️ Important Notes

- YouTube stats may show 0 for first hour after posting (normal)
- Instagram insights available 24h after posting (API limitation)
- Stats refresh runs every 2 hours for last 7 days of posts
- Older posts (>7 days) won't auto-refresh (save API quota)
- Manual refresh anytime: `POST /stats/refresh` with custom params

## 🔧 Build Status

✅ Railway worker compiles (`npm run build`)
✅ Vercel endpoints compile (no TypeScript errors)
✅ Migration ready to deploy
✅ Cron job configured

**All code ready for deployment!**
