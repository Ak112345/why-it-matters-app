/**
 * API endpoint for content review and approval
 * GET /api/content/review - Get pending review tasks
 * POST /api/content/review - Submit approval/rejection
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getPendingReviewTasks,
  assignReviewTask,
  submitApproval,
  getApprovalStats,
  requestRevisions,
} from '@/src/content-management/approvalWorkflow';

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action') || 'pending';

    if (action === 'pending') {
      const limit = parseInt(searchParams.get('limit') || '50', 10);
      const tasks = await getPendingReviewTasks(limit);
      return NextResponse.json({
        success: true,
        data: tasks,
        count: tasks.length,
      });
    }

    if (action === 'stats') {
      const stats = await getApprovalStats();
      return NextResponse.json({
        success: true,
        data: stats,
      });
    }

    return NextResponse.json(
      { error: 'Unknown action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Review fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch review tasks' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 });
  }

  // create supabase client here if needed

  try {
    const body = await request.json();
    const { action, taskId, editorId, approved, feedback, clipId, revisions } = body;

    if (action === 'assign') {
      if (!taskId || !editorId) {
        return NextResponse.json(
          { error: 'Missing taskId or editorId' },
          { status: 400 }
        );
      }
      const result = await assignReviewTask(taskId, editorId);
      return NextResponse.json({
        success: result,
        message: result ? 'Task assigned' : 'Failed to assign task',
      });
    }

    if (action === 'submit-review') {
      if (!taskId || !editorId || approved === undefined) {
        return NextResponse.json(
          { error: 'Missing taskId, editorId, or approved' },
          { status: 400 }
        );
      }
      const result = await submitApproval(taskId, approved, feedback || '', editorId);
      return NextResponse.json({
        success: result,
        message: result
          ? approved
            ? 'Content approved for production'
            : 'Revision request created'
          : 'Failed to submit review',
      });
    }

    if (action === 'request-revisions') {
      if (!clipId || !Array.isArray(revisions)) {
        return NextResponse.json(
          { error: 'Missing clipId or revisions array' },
          { status: 400 }
        );
      }
      const task = await requestRevisions(clipId, revisions);
      return NextResponse.json({
        success: true,
        data: task,
        message: 'Revision request created',
      });
    }

    return NextResponse.json(
      { error: 'Unknown action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Review submission error:', error);
    return NextResponse.json(
      { error: 'Failed to process review' },
      { status: 500 }
    );
  }
}
