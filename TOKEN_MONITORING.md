# Automated Token Monitoring System ✅

## Overview
Your platform tokens now have **automatic expiration monitoring** with daily health checks and alerts.

## Features

### 🔄 Auto-Refresh on Every Publish
- **YouTube**: Refreshes OAuth token before each upload (using refresh token)
- **Meta/Facebook/Instagram**: Fetches fresh page token before each post (from user token)

### 📊 Daily Health Monitoring  
- **Cron Job**: Runs every day at 8:00 AM UTC
- **Checks**: Token validity, expiration dates, days remaining
- **Alerts**: Creates system alerts when tokens are expiring

### 🚨 Alert Levels
- **🟢 Healthy**: Token valid, >14 days remaining
- **🟡 Warning**: 7-14 days until expiry
- **🔴 Critical**: <7 days until expiry
- **❌ Expired**: Token no longer valid

### 📱 Dashboard Integration
- **Admin Panel**: Live token status at `/admin`
- **Auto-refresh**: Updates every 5 minutes
- **Visual Indicators**: Color-coded status cards

## How It Works

### 1. Token Auto-Refresh (Before Each Post)
```typescript
// Instagram/Facebook publish
const token = await refreshInstagramToken(); // Gets fresh token
await publishToInstagram(videoUrl, caption);   // Uses fresh token

// YouTube publish  
const token = await refreshYouTubeToken();     // Gets fresh token
await publishToYouTube(videoUrl, caption);     // Uses fresh token
```

### 2. Daily Monitoring (Cron)
```
Schedule: Every day at 8:00 AM UTC
Endpoint: /api/tokens/monitor
Actions:
  ✓ Check all platform tokens
  ✓ Calculate days until expiry
  ✓ Create alerts if needed
  ✓ Log status to database
```

### 3. Real-Time Dashboard
```
View: /admin
Features:
  • Live token status
  • Days until expiry
  • Color-coded warnings
  • Manual refresh button
  • Action required notices
```

## API Endpoints

### GET /api/tokens/health
**Purpose**: Check current token health  
**Auth**: None (public)  
**Response**:
```json
{
  "success": true,
  "timestamp": "2026-03-02T21:00:00Z",
  "tokens": [
    {
      "platform": "meta",
      "token_type": "user_access_token",
      "status": "healthy",
      "message": "Token valid for 52 days",
      "expires_at": "2026-04-23T00:00:00Z",
      "days_until_expiry": 52
    },
    {
      "platform": "youtube",
      "token_type": "refresh_token",
      "status": "healthy",
      "message": "Token is valid and working"
    }
  ],
  "alerts_created": 0
}
```

### GET /api/tokens/monitor
**Purpose**: Daily cron job endpoint  
**Auth**: Vercel cron secret  
**Schedule**: 8:00 AM UTC daily (via vercel.json)  
**Response**: Same as /health, plus creates alerts

## Database Schema

### `token_health_log` Table
Stores latest token status (upserted daily):
```sql
platform          | text      | 'meta', 'youtube'
token_type        | text      | 'user_access_token', 'refresh_token'
status            | text      | 'healthy', 'warning', 'critical', 'expired'
expires_at        | timestamp | Token expiration date
days_until_expiry | integer   | Days remaining
message           | text      | Human-readable status
checked_at        | timestamp | Last check time
```

### `system_alerts` Table
Stores critical alerts:
```sql
type        | text      | 'token_expiry'
platform    | text      | 'meta', 'youtube'
message     | text      | Alert message
severity    | text      | 'low', 'medium', 'high', 'critical'
acknowledged| boolean   | User acknowledged
metadata    | jsonb     | Additional data
```

## Setup Instructions

### 1. Deploy Code
```bash
git add .
git commit -m "feat: add automated token monitoring"
git push
```

### 2. Run Database Migration
```bash
# Option A: Via Supabase Dashboard
# Go to SQL Editor, paste contents of migrations/005_token_monitoring.sql

# Option B: Via psql (if available)
psql $DATABASE_URL < migrations/005_token_monitoring.sql
```

### 3. Verify Deployment
```bash
# Test token monitoring
curl https://why-it-matters-app.vercel.app/api/tokens/health

# Check admin dashboard
open https://why-it-matters-app.vercel.app/admin
```

### 4. Verify Cron Job
Go to Vercel Dashboard → Settings → Cron Jobs  
Should see:
- ✅ `/api/tokens/monitor` - Daily at 8:00 AM

## Environment Variables

### Required (Already Configured)
```env
# YouTube
YOUTUBE_CLIENT_ID=883094676161-...
YOUTUBE_CLIENT_SECRET=GOCSPX-...
YOUTUBE_REFRESH_TOKEN=1//04qX2YYK6cO0l...

# Meta
META_USER_ACCESS_TOKEN=EAAKGgWQdwL0BQ6JJOMr...  # Long-lived (60 days)
META_APP_ID=710840241995965
META_APP_SECRET=84cdd39fa7f85c3f36557c70c5cd3c5a
FACEBOOK_PAGE_ID=1052339091287287
INSTAGRAM_BUSINESS_ID=17841480679369169

# Supabase
SUPABASE_URL=https://aiwijowbfdfcfivrmrao.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...

# Vercel
VERCEL_CRON_SECRET=XI92wVtr0G9MHmvb5IQY7UAdXGKcx3nEVuQMDrO4iOQ=
```

## Monitoring & Alerts

### How You'll Be Notified

1. **Admin Dashboard** (Real-time)
   - Visit `/admin` to see live token status
   - Color-coded warnings appear automatically
   - Shows days until expiry

2. **System Alerts** (Database)
   - Critical alerts stored in `system_alerts` table
   - Can query via Supabase dashboard
   - Future: Email/Slack notifications (optional)

3. **Logs** (Vercel)
   - Daily cron logs in Vercel dashboard
   - Search for "TOKEN ALERT" or "TOKEN WARNING"

### Example Scenarios

**Scenario 1: Meta Token Expiring in 5 Days**
- ✅ Dashboard shows 🔴 Critical status
- ✅ Alert created in database
- ✅ Message: "⚠️ URGENT: Token expires in 5 days! Renew immediately."
- ✅ Action required notice shown

**Scenario 2: YouTube Token Revoked**
- ✅ Dashboard shows ❌ Expired status
- ✅ Alert created in database
- ✅ Message: "Token refresh failed: invalid_grant"
- ✅ Action: Re-authenticate and get new refresh token

**Scenario 3: All Healthy**
- ✅ Dashboard shows 🟢 Healthy for all
- ✅ No alerts created
- ✅ Publishing continues normally

## Maintenance

### Meta Token Renewal (Every ~60 Days)
When you see critical/expiring warning:

1. Go to [Meta Graph API Explorer](https://developers.facebook.com/tools/explorer/)
2. Select your app, get new user token with permissions
3. Exchange for long-lived token:
   ```bash
   curl "https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=710840241995965&client_secret=YOUR_SECRET&fb_exchange_token=SHORT_TOKEN"
   ```
4. Update environment variable:
   ```bash
   vercel env add META_USER_ACCESS_TOKEN production
   # Paste new token
   ```

### YouTube Token Renewal (If Revoked)
If YouTube token fails:

1. Re-authenticate via OAuth flow
2. Get new refresh token
3. Update environment variable:
   ```bash
   vercel env add YOUTUBE_REFRESH_TOKEN production
   # Paste new token
   ```

## Testing

### Manual Test
```bash
# Check token health now
curl https://why-it-matters-app.vercel.app/api/tokens/health | jq .

# Expected output
{
  "success": true,
  "tokens": [
    { "platform": "meta", "status": "healthy", ... },
    { "platform": "youtube", "status": "healthy", ... }
  ]
}
```

### View Dashboard
```bash
# Open admin page
open https://why-it-matters-app.vercel.app/admin
```

### Simulate Expiring Token
```typescript
// In tokenMonitoring.ts, temporarily change threshold:
if (daysUntilExpiry <= 60) { // Instead of 7
  status = 'critical';
}
```

## Troubleshooting

### Dashboard Not Showing Tokens
**Cause**: Migration not run  
**Fix**: Run `migrations/005_token_monitoring.sql` in Supabase

### "Token refresh failed"
**Cause**: Invalid credentials  
**Fix**: Check environment variables are set correctly

### Cron Not Running
**Cause**: Vercel deployment issue  
**Fix**: Check Vercel dashboard → Cron Jobs → Logs

### Alerts Not Created
**Cause**: Database permissions  
**Fix**: Verify RLS policies allow service role insert

## Future Enhancements

### Optional Additions
- [ ] Email alerts when tokens expire soon
- [ ] Slack/Discord webhook notifications
- [ ] Auto-renewal for Meta tokens (if possible)
- [ ] Token health metrics/trends
- [ ] Multi-channel alert delivery

## Summary

✅ **Auto-refresh**: Fresh tokens on every publish  
✅ **Daily monitoring**: Checks expiration automatically  
✅ **Visual alerts**: Dashboard shows status  
✅ **Database logging**: Full audit trail  
✅ **Proactive warnings**: 7-14 day advance notice  

**No more expired token surprises!** 🎉
