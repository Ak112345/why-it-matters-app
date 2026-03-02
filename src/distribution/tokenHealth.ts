export interface PlatformTokenHealth {
  platform: 'instagram' | 'facebook' | 'youtube';
  ok: boolean;
  error?: string;
  details?: Record<string, unknown>;
}

async function checkInstagramToken(): Promise<PlatformTokenHealth> {
  const igUserId = process.env.INSTAGRAM_USER_ID || process.env.META_IG_BUSINESS_ID;
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN || process.env.META_PAGE_ACESS_TOKEN;

  if (!igUserId || !accessToken) {
    return {
      platform: 'instagram',
      ok: false,
      error: 'Missing INSTAGRAM_USER_ID/META_IG_BUSINESS_ID or INSTAGRAM_ACCESS_TOKEN',
    };
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${igUserId}?fields=id,username&access_token=${accessToken}`
    );
    const data = await res.json();

    if (!res.ok || data?.error) {
      return {
        platform: 'instagram',
        ok: false,
        error: data?.error?.message || `Instagram token check failed (${res.status})`,
      };
    }

    return {
      platform: 'instagram',
      ok: true,
      details: { igUserId: data?.id, username: data?.username },
    };
  } catch (err: any) {
    return {
      platform: 'instagram',
      ok: false,
      error: err?.message || 'Instagram token check failed',
    };
  }
}

async function checkFacebookToken(): Promise<PlatformTokenHealth> {
  const pageId = process.env.META_BUSINESS_FACEBOOK_ID;
  const accessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN || process.env.META_PAGE_ACESS_TOKEN;

  if (!pageId || !accessToken) {
    return {
      platform: 'facebook',
      ok: false,
      error: 'Missing META_BUSINESS_FACEBOOK_ID or FACEBOOK_PAGE_ACCESS_TOKEN',
    };
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${pageId}?fields=id,name&access_token=${accessToken}`
    );
    const data = await res.json();

    if (!res.ok || data?.error) {
      return {
        platform: 'facebook',
        ok: false,
        error: data?.error?.message || `Facebook token check failed (${res.status})`,
      };
    }

    return {
      platform: 'facebook',
      ok: true,
      details: { pageId: data?.id, name: data?.name },
    };
  } catch (err: any) {
    return {
      platform: 'facebook',
      ok: false,
      error: err?.message || 'Facebook token check failed',
    };
  }
}

async function checkYouTubeToken(): Promise<PlatformTokenHealth> {
  const youtubeClientId = process.env.YOUTUBE_CLIENT_ID;
  const youtubeClientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  const oauthClientId = process.env.OAUTH_CLIENT_ID;
  const oauthClientSecret = process.env.OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.YOUTUBE_REFRESH_TOKEN;

  const hasYouTubePair = !!youtubeClientId && !!youtubeClientSecret;
  const hasOAuthPair = !!oauthClientId && !!oauthClientSecret;
  const clientId = hasYouTubePair ? youtubeClientId : (hasOAuthPair ? oauthClientId : undefined);
  const clientSecret = hasYouTubePair ? youtubeClientSecret : (hasOAuthPair ? oauthClientSecret : undefined);

  if (!clientId || !clientSecret || !refreshToken) {
    return {
      platform: 'youtube',
      ok: false,
      error: 'Missing YOUTUBE_CLIENT_ID/(YOUTUBE_CLIENT_SECRET or OAUTH_CLIENT_SECRET)/YOUTUBE_REFRESH_TOKEN',
    };
  }

  try {
    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    });

    const data = await res.json();

    if (!res.ok || !data?.access_token) {
      return {
        platform: 'youtube',
        ok: false,
        error: data?.error_description || data?.error || `YouTube token refresh failed (${res.status})`,
      };
    }

    return {
      platform: 'youtube',
      ok: true,
      details: {
        expiresIn: data?.expires_in,
        tokenType: data?.token_type,
        scope: data?.scope,
      },
    };
  } catch (err: any) {
    return {
      platform: 'youtube',
      ok: false,
      error: err?.message || 'YouTube token check failed',
    };
  }
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
