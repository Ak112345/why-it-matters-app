/**
 * API endpoint for content performance tracking
 * POST /api/content/performance - Record performance metrics
 * GET /api/content/performance - Get analytics for period
 */

import { NextResponse } from 'next/server';
import {
  recordPerformanceMetrics,
  getAggregatedAnalytics,
  getPillarPerformance,
} from '@/src/content-management/performanceTracking';

export async function POST() {
  try {
    const body = await request.json();
    const { videoId, platform, metrics } = body;

    if (!videoId || !platform || !metrics) {
      return NextResponse.json(
        { error: 'Missing required fields: videoId, platform, metrics' },
        { status: 400 }
      );
    }

    const performance = await recordPerformanceMetrics(videoId, platform, metrics);

    return NextResponse.json({
      success: true,
      data: performance,
      message: 'Performance metrics recorded',
    });
  } catch (error) {
    console.error('Performance recording error:', error);
    return NextResponse.json(
      { error: 'Failed to record performance metrics' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action');

    if (action === 'aggregated') {
      const days = parseInt(searchParams.get('days') || '30', 10);
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const analytics = await getAggregatedAnalytics(startDate, endDate);
      return NextResponse.json({
        success: true,
        data: analytics,
        period: { startDate, endDate, days },
      });
    }

    if (action === 'by-pillar') {
      const pillar = searchParams.get('pillar');
      if (!pillar) {
        return NextResponse.json(
          { error: 'Missing pillar parameter' },
          { status: 400 }
        );
      }

      const performance = await getPillarPerformance(pillar);
      return NextResponse.json({
        success: true,
        data: performance,
      });
    }

    return NextResponse.json(
      { error: 'Unknown action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Performance analytics error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch performance analytics' },
      { status: 500 }
    );
  }
}
