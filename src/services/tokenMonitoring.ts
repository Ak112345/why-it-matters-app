/**
 * Token Monitoring Service
 * Checks token health and sends alerts before expiration
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder'
);

interface TokenStatus {
  platform: string;
  token_type: string;
  expires_at?: string;
  days_until_expiry?: number;
  status: 'healthy' | 'warning' | 'critical' | 'expired' | 'unknown';
  message: string;
}

/**
 * Check Meta/Facebook token expiry
 * Returns token info including expiration date
 */
async function checkMetaTokenHealth(): Promise<TokenStatus> {
  const userToken = process.env.META_USER_ACCESS_TOKEN;
  
  if (!userToken) {
    return {
      platform: 'meta',
      token_type: 'user_access_token',
      status: 'critical',
      message: 'META_USER_ACCESS_TOKEN not configured',
    };
  }

  try {
    // Get token debug info from Meta
    const res = await fetch(
      `https://graph.facebook.com/v19.0/debug_token?input_token=${userToken}&access_token=${process.env.META_APP_ID}|${process.env.META_APP_SECRET}`
    );

    const data = await res.json();
    
    if (data.error) {
      return {
        platform: 'meta',
        token_type: 'user_access_token',
        status: 'critical',
        message: `Token invalid: ${data.error.message}`,
      };
    }

    const tokenData = data.data;
    const isValid = tokenData.is_valid;
    const expiresAt = tokenData.expires_at; // Unix timestamp (0 = never expires)
    const dataAccessExpiresAt = tokenData.data_access_expires_at; // Unix timestamp

    if (!isValid) {
      return {
        platform: 'meta',
        token_type: 'user_access_token',
        status: 'expired',
        message: 'Token is invalid or expired',
      };
    }

    // Check data access expiration (the real expiry for long-lived tokens)
    if (dataAccessExpiresAt && dataAccessExpiresAt > 0) {
      const expiryDate = new Date(dataAccessExpiresAt * 1000);
      const now = new Date();
      const daysUntilExpiry = Math.floor((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      let status: TokenStatus['status'] = 'healthy';
      let message = `Token valid for ${daysUntilExpiry} more days`;

      if (daysUntilExpiry <= 0) {
        status = 'expired';
        message = 'Token has expired';
      } else if (daysUntilExpiry <= 7) {
        status = 'critical';
        message = `⚠️ URGENT: Token expires in ${daysUntilExpiry} days! Renew immediately.`;
      } else if (daysUntilExpiry <= 14) {
        status = 'warning';
        message = `⚠️ Token expires in ${daysUntilExpiry} days. Plan to renew soon.`;
      }

      return {
        platform: 'meta',
        token_type: 'user_access_token',
        expires_at: expiryDate.toISOString(),
        days_until_expiry: daysUntilExpiry,
        status,
        message,
      };
    }

    return {
      platform: 'meta',
      token_type: 'user_access_token',
      status: 'healthy',
      message: 'Token is valid (no expiration found)',
    };
  } catch (error: any) {
    return {
      platform: 'meta',
      token_type: 'user_access_token',
      status: 'unknown',
      message: `Error checking token: ${error.message}`,
    };
  }
}

/**
 * Check YouTube token health
 * Refresh tokens don't expire unless revoked
 */
async function checkYouTubeTokenHealth(): Promise<TokenStatus> {
  const refreshToken = process.env.YOUTUBE_REFRESH_TOKEN;
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;

  if (!refreshToken || !clientId || !clientSecret) {
    return {
      platform: 'youtube',
      token_type: 'refresh_token',
      status: 'critical',
      message: 'YouTube OAuth credentials not configured',
    };
  }

  try {
    // Try to refresh the token to verify it's valid
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    const data = await res.json();

    if (res.ok && data.access_token) {
      return {
        platform: 'youtube',
        token_type: 'refresh_token',
        status: 'healthy',
        message: 'Token is valid and working',
      };
    } else {
      return {
        platform: 'youtube',
        token_type: 'refresh_token',
        status: 'critical',
        message: `Token refresh failed: ${data.error || res.status}`,
      };
    }
  } catch (error: any) {
    return {
      platform: 'youtube',
      token_type: 'refresh_token',
      status: 'unknown',
      message: `Error checking token: ${error.message}`,
    };
  }
}

/**
 * Check all platform tokens
 */
export async function checkAllTokens(): Promise<TokenStatus[]> {
  const [metaStatus, youtubeStatus] = await Promise.all([
    checkMetaTokenHealth(),
    checkYouTubeTokenHealth(),
  ]);

  return [metaStatus, youtubeStatus];
}

/**
 * Create system alerts for expiring tokens
 */
export async function createTokenAlerts(statuses: TokenStatus[]): Promise<void> {
  for (const status of statuses) {
    if (status.status === 'critical' || status.status === 'expired') {
      // Create alert in system_alerts table
      await supabase.from('system_alerts').insert({
        type: 'token_expiry',
        platform: status.platform,
        message: status.message,
        severity: status.status === 'expired' ? 'critical' : 'high',
        metadata: {
          token_type: status.token_type,
          expires_at: status.expires_at,
          days_until_expiry: status.days_until_expiry,
        },
      });

      console.error(`[TOKEN ALERT] ${status.platform}: ${status.message}`);
    } else if (status.status === 'warning') {
      await supabase.from('system_alerts').insert({
        type: 'token_expiry',
        platform: status.platform,
        message: status.message,
        severity: 'medium',
        metadata: {
          token_type: status.token_type,
          expires_at: status.expires_at,
          days_until_expiry: status.days_until_expiry,
        },
      });

      console.warn(`[TOKEN WARNING] ${status.platform}: ${status.message}`);
    }
  }
}

/**
 * Log token status to database
 */
export async function logTokenStatus(statuses: TokenStatus[]): Promise<void> {
  const timestamp = new Date().toISOString();
  
  for (const status of statuses) {
    await supabase.from('token_health_log').upsert({
      platform: status.platform,
      token_type: status.token_type,
      status: status.status,
      expires_at: status.expires_at,
      days_until_expiry: status.days_until_expiry,
      message: status.message,
      checked_at: timestamp,
    }, {
      onConflict: 'platform,token_type',
    });
  }
}

/**
 * Main monitoring function
 * Run this on a schedule (daily)
 */
export async function monitorTokens(): Promise<{
  success: boolean;
  statuses: TokenStatus[];
  alerts_created: number;
}> {
  try {
    console.log('[Token Monitor] Checking all platform tokens...');
    
    const statuses = await checkAllTokens();
    
    // Log to database
    await logTokenStatus(statuses);
    
    // Create alerts for critical issues
    await createTokenAlerts(statuses);
    
    const alertCount = statuses.filter(
      s => s.status === 'critical' || s.status === 'expired' || s.status === 'warning'
    ).length;

    console.log('[Token Monitor] Check complete:', {
      meta: statuses.find(s => s.platform === 'meta')?.status,
      youtube: statuses.find(s => s.platform === 'youtube')?.status,
      alerts: alertCount,
    });

    return {
      success: true,
      statuses,
      alerts_created: alertCount,
    };
  } catch (error: any) {
    console.error('[Token Monitor] Error:', error.message);
    return {
      success: false,
      statuses: [],
      alerts_created: 0,
    };
  }
}
