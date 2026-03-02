export const dynamic = 'force-dynamic';

/**
 * Token Health Check API
 * GET /api/tokens/health
 * 
 * Checks all platform tokens and returns their status
 */

import { NextResponse } from 'next/server';
import { monitorTokens } from '../../../../src/services/tokenMonitoring';

export async function GET() {
  try {
    const result = await monitorTokens();

    return NextResponse.json({
      success: result.success,
      timestamp: new Date().toISOString(),
      tokens: result.statuses,
      alerts_created: result.alerts_created,
    });
  } catch (error: any) {
    console.error('[Token Health API] Error:', error);
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
