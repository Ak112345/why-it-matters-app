export const dynamic = 'force-dynamic';

/**
 * Token Monitoring Cron Endpoint
 * GET /api/tokens/monitor
 * 
 * Scheduled to run daily via Vercel Cron
 * Checks token health and creates alerts
 */

import { NextResponse } from 'next/server';
import { monitorTokens } from '../../../../src/services/tokenMonitoring';

export async function GET(request: Request) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.VERCEL_CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[Token Monitor Cron] Starting daily token health check...');

    const result = await monitorTokens();

    const response = {
      success: result.success,
      timestamp: new Date().toISOString(),
      summary: {
        total_tokens: result.statuses.length,
        healthy: result.statuses.filter(s => s.status === 'healthy').length,
        warning: result.statuses.filter(s => s.status === 'warning').length,
        critical: result.statuses.filter(s => s.status === 'critical').length,
        expired: result.statuses.filter(s => s.status === 'expired').length,
        alerts_created: result.alerts_created,
      },
      tokens: result.statuses.map(s => ({
        platform: s.platform,
        status: s.status,
        message: s.message,
        days_until_expiry: s.days_until_expiry,
        expires_at: s.expires_at,
      })),
    };

    console.log('[Token Monitor Cron] Complete:', response.summary);

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('[Token Monitor Cron] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
