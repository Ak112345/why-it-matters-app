/**
 * API endpoint for content approval workflow
 * POST /api/content/approve - Run content through director approval
 * GET /api/content/director-brief - Get director's summary
 * GET /api/content/performance - Get performance analytics
 */

import { NextRequest, NextResponse } from 'next/server';
import { directorApproveContent, getDirectorBrief, getWeeklyStrategy } from '@/src/content-management/contentDirector';
// eslint-disable-next-line @typescript-eslint/no-unused-vars

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, clipId, analysisData } = body;

    if (action === 'approve-content') {
      if (!clipId || !analysisData) {
        return NextResponse.json(
          { error: 'Missing clipId or analysisData' },
          { status: 400 }
        );
      }

      const result = await directorApproveContent(clipId, analysisData);

      return NextResponse.json({
        success: true,
        data: result,
        message: `Content ${result.status}`,
      });
    }

    return NextResponse.json(
      { error: 'Unknown action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Content approval error:', error);
    return NextResponse.json(
      { error: 'Failed to process content approval' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action');

    if (action === 'director-brief') {
      const brief = await getDirectorBrief();
      return NextResponse.json({ success: true, data: brief });
    }

    if (action === 'weekly-strategy') {
      const week = parseInt(searchParams.get('week') || '0', 10);
      const strategy = getWeeklyStrategy(week);
      return NextResponse.json({ success: true, data: strategy });
    }

    return NextResponse.json(
      { error: 'Unknown action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Content director error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch director data' },
      { status: 500 }
    );
  }
}
