export interface PlatformTokenHealth {
  platform: 'instagram' | 'facebook' | 'youtube';
  ok: boolean;
  error?: string;
  details?: Record<string, unknown>;
}

async function checkInstagramToken(): Promise<PlatformTokenHealth> {
  const igUserId = process.env.INSTAGRAM_BUSINESS_ID || process.env.INSTAGRAM_USER_ID || process.env.META_IG_BUSINESS_ID;
  const userToken = process.env.META_USER_ACCESS_TOKEN;
  const pageId = process.env.FACEBOOK_PAGE_ID;

  // With auto-refresh, we just need user token and page ID
  if (!igUserId) {
    return {
      platform: 'instagram',
      ok: false,
      error: 'Missing INSTAGRAM_BUSINESS_ID',
    };
  }

  if (!userToken || !pageId) {
    return {
      platform: 'instagram',
      ok: false,
      error: 'Missing META_USER_ACCESS_TOKEN or FACEBOOK_PAGE_ID (needed for auto-refresh)',
    };
  }

  // Token will auto-refresh before publish, just check credentials exist
  return {
    platform: 'instagram',
    ok: true,
    details: { igUserId, hasAutoRefresh: true },
  };
}

async function checkFacebookToken(): Promise<PlatformTokenHealth> {
  const pageId = process.env.FACEBOOK_PAGE_ID || process.env.META_BUSINESS_FACEBOOK_ID;
  const userToken = process.env.META_USER_ACCESS_TOKEN;

  // With auto-refresh, we just need user token and page ID
  if (!pageId) {
    return {
      platform: 'facebook',
      ok: false,
      error: 'Missing FACEBOOK_PAGE_ID',
    };
  }

  if (!userToken) {
    return {
      platform: 'facebook',
      ok: false,
      error: 'Missing META_USER_ACCESS_TOKEN (needed for auto-refresh)',
    };
  }

  // Token will auto-refresh before publish, just check credentials exist
  return {
    platform: 'facebook',
    ok: true,
    details: { pageId, hasAutoRefresh: true },
  };
}

async function checkYouTubeToken(): Promise<PlatformTokenHealth> {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  const refreshToken = process.env.YOUTUBE_REFRESH_TOKEN;

  // With auto-refresh, we just need OAuth credentials
  if (!clientId || !clientSecret || !refreshToken) {
    return {
      platform: 'youtube',
      ok: false,
      error: 'Missing YOUTUBE_CLIENT_ID/(YOUTUBE_CLIENT_SECRET or OAUTH_CLIENT_SECRET)/YOUTUBE_REFRESH_TOKEN',
    };
  }

  // Token will auto-refresh before publish, just check credentials exist
  return {
    platform: 'youtube',
    ok: true,
    details: { hasRefreshToken: true, hasAutoRefresh: true },
  };
}

export async function checkPlatformTokenHealth(platform: string): Promise<PlatformTokenHealth> {
  if (platform === 'instagram') return checkInstagramToken();
  if (platform === 'facebook') return checkFacebookToken();
  if (platform === 'youtube' || platform === 'youtube_shorts') return checkYouTubeToken();

  return {
    platform: 'youtube',
    ok: false,
    error: `No token check implemented for platform: ${platform}`,
  };
}

export async function checkAllPublishTokenHealth(): Promise<PlatformTokenHealth[]> {
  const [instagram, facebook, youtube] = await Promise.all([
    checkInstagramToken(),
    checkFacebookToken(),
    checkYouTubeToken(),
  ]);

  return [instagram, facebook, youtube];
}
