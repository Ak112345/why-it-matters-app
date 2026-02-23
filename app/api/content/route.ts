/**
 * API endpoint for content management dashboard
 * GET /api/content - Get overview and statistics
 */

import { NextResponse } from 'next/server';
import { getDirectorBrief } from '@/src/content-management/contentDirector';
import { getApprovalStats } from '@/src/content-management/approvalWorkflow';
import { getAggregatedAnalytics } from '@/src/content-management/performanceTracking';

export async function GET() {
  try {
    // Fetch all dashboard data in parallel
    const [directorBrief, approvalStats, analytics] = await Promise.all([
      getDirectorBrief(),
      getApprovalStats(),
      (async () => {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 7); // last 7 days
        return getAggregatedAnalytics(startDate, endDate);
      })(),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        directorBrief,
        approvalStats,
        weeklyAnalytics: analytics,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Content dashboard error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch content dashboard data' },
      { status: 500 }
    );
  }
}
