# Access Token Auto-Refresh Setup

## Overview
All platform tokens now **auto-refresh** before each publish, preventing expiration issues.

## ✅ YouTube Setup

### Required Environment Variables
```env
YOUTUBE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
YOUTUBE_CLIENT_SECRET="your-client-secret"
YOUTUBE_REFRESH_TOKEN="1//04xxx..."
```

### How It Works
- **Token expires**: Every 1 hour
- **Auto-refresh**: Uses OAuth2 refresh token before each upload
- **Endpoint**: `https://oauth2.googleapis.com/token`
- **Grant type**: `refresh_token`

### Getting Your Refresh Token
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Enable YouTube Data API v3
3. Create OAuth 2.0 credentials (Web application)
4. Add redirect URI: `https://your-app.vercel.app/api/auth/callback/google`
5. Use OAuth playground or NextAuth to obtain refresh token with scopes:
   - `https://www.googleapis.com/auth/youtube.upload`
   - `https://www.googleapis.com/auth/youtube.readonly`

---

## ✅ Meta/Facebook/Instagram Setup

### Required Environment Variables
```env
META_USER_ACCESS_TOKEN="EAAKGgWQdwL0BQ6JJOMr..."  # Long-lived user token
META_APP_ID="710840241995965"
META_APP_SECRET="your-app-secret"
FACEBOOK_PAGE_ID="1052339091287287"
INSTAGRAM_BUSINESS_ID="17841480679369169"
```

### How It Works
- **Token expires**: Page tokens expire, but can be refreshed
- **Auto-refresh**: Uses long-lived user token to get fresh page token before each post
- **Endpoint**: `https://graph.facebook.com/v19.0/{page-id}?fields=access_token&access_token={user-token}`
- **Single token**: Same page token works for both Facebook and Instagram

### Getting Your Long-Lived User Access Token

1. **Get Short-Lived User Token**
   - Go to [Meta Graph API Explorer](https://developers.facebook.com/tools/explorer/)
   - Select your app
   - Get token with permissions: `pages_read_engagement`, `pages_manage_posts`, `instagram_basic`, `instagram_content_publish`

2. **Exchange for Long-Lived Token** (60 days)
   ```bash
   curl -i -X GET "https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id={app-id}&client_secret={app-secret}&fb_exchange_token={short-lived-token}"
   ```

3. **Save the Long-Lived Token**
   - Add to `.env.local` as `META_USER_ACCESS_TOKEN`
   - This token lasts 60 days and auto-refreshes page tokens

### Important Notes
- 🔄 **Page tokens auto-refresh** before each post
- ⏰ **User token lasts 60 days** - set a reminder to refresh it manually
- ✅ **No need to update** `FACEBOOK_PAGE_ACCESS_TOKEN` or `INSTAGRAM_ACCESS_TOKEN` anymore
- 🎯 **Single source**: Everything derives from the user token

---

## ❌ TikTok (No Auto-Refresh Available)

TikTok doesn't support token refresh. Videos are saved to storage for manual batch upload via TikTok Creator Tools.

---

## Implementation Details

### Token Refresh Functions

**YouTube:**
```typescript
async function refreshYouTubeToken(): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.YOUTUBE_CLIENT_ID!,
      client_secret: process.env.YOUTUBE_CLIENT_SECRET!,
      refresh_token: process.env.YOUTUBE_REFRESH_TOKEN!,
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json();
  return data.access_token; // Fresh token valid for 1 hour
}
```

**Meta (Facebook/Instagram):**
```typescript
async function refreshMetaPageToken(): Promise<string> {
  const res = await fetch(
    `https://graph.facebook.com/v19.0/${pageId}?fields=access_token&access_token=${userToken}`
  );
  const data = await res.json();
  return data.access_token; // Fresh page token
}
```

### When Tokens Refresh
- **Every publish**: Fresh token requested before each video upload
- **Zero stale tokens**: Never uses cached/expired tokens
- **Automatic**: No manual intervention needed (except 60-day user token renewal for Meta)

---

## Troubleshooting

### YouTube Token Issues
❌ **Error**: "YouTube token refresh failed: invalid_grant"
- **Cause**: Refresh token expired or revoked
- **Fix**: Re-authenticate and get new refresh token

### Meta Token Issues
❌ **Error**: "Failed to refresh page token"
- **Cause**: User token expired (60 days)
- **Fix**: Generate new long-lived user token (see steps above)

❌ **Error**: "Missing FACEBOOK_PAGE_ID"
- **Cause**: Page ID not in environment
- **Fix**: Find your page ID at `https://www.facebook.com/{your-page}` → About

---

## Migration Guide

### Old Way (Static Tokens - Expire)
```env
FACEBOOK_PAGE_ACCESS_TOKEN="static_token_expires_in_60_days"
INSTAGRAM_ACCESS_TOKEN="static_token_expires_in_60_days"
```

### New Way (Auto-Refresh)
```env
META_USER_ACCESS_TOKEN="long_lived_user_token"  # Only this is needed
FACEBOOK_PAGE_ID="your_page_id"
INSTAGRAM_BUSINESS_ID="your_ig_business_id"
```

The system now **auto-generates** fresh page tokens before each publish!
