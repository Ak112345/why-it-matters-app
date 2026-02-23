/**
 * Content Approval Workflow
 * Manages editorial review and approval process
 */

import { supabase } from '../utils/supabaseClient';

export enum ReviewStage {
  PENDING = 'pending',
  IN_REVIEW = 'in_review',
  APPROVED = 'approved',
  REVISION_REQUESTED = 'revision_requested',
  ARCHIVED = 'archived',
}

export interface ReviewTask {
  id: string;
  clipId: string;
  stage: ReviewStage;
  createdAt: Date;
  assignedTo?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  issues: {
    type: 'critical' | 'suggestion' | 'info';
    message: string;
    field?: string;
  }[];
  feedback: string;
  decidedAt?: Date;
  decidedBy?: string;
}

/**
 * Create a review task for editor
 */
export async function createReviewTask(
  clipId: string,
  issues: ReviewTask['issues'],
  priority: ReviewTask['priority'] = 'medium'
): Promise<ReviewTask> {
  const task: ReviewTask = {
    id: `review_${Date.now()}`,
    clipId,
    stage: ReviewStage.PENDING,
    createdAt: new Date(),
    priority,
    issues,
    feedback: '',
  };

  try {
    const { error } = await supabase.from('review_tasks').insert({
      id: task.id,
      clip_id: clipId,
      stage: task.stage,
      priority,
      issues: issues as any,
      created_at: task.createdAt.toISOString(),
    } as any);

    if (error) {
      console.error('Error creating review task:', error);
    }
  } catch (error) {
    console.error('Error creating review task:', error);
  }

  return task;
}

/**
 * Get pending review tasks
 */
export async function getPendingReviewTasks(
  limit = 50
): Promise<ReviewTask[]> {
  try {
    const { data, error } = await supabase
      .from('review_tasks')
      .select('*')
      .in('stage', [ReviewStage.PENDING, ReviewStage.IN_REVIEW])
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error || !data) {
      return [];
    }

    return data.map((item: any) => ({
      id: item.id,
      clipId: item.clip_id,
      stage: item.stage,
      createdAt: new Date(item.created_at),
      assignedTo: item.assigned_to,
      priority: item.priority,
      issues: item.issues || [],
      feedback: item.feedback || '',
      decidedAt: item.decided_at ? new Date(item.decided_at) : undefined,
      decidedBy: item.decided_by,
    }));
  } catch (error) {
    console.error('Error getting pending review tasks:', error);
    return [];
  }
}

/**
 * Assign task to an editor
 */
export async function assignReviewTask(
  taskId: string,
  editorId: string
): Promise<boolean> {
  const taskIdNum = Number(taskId);
  if (!Number.isFinite(taskIdNum)) {
    throw new Error(`Invalid taskId (expected number): ${taskId}`);
  }
  const { error } = await supabase
    .from('review_tasks')
    .update({
      assigned_to: editorId,
      stage: ReviewStage.IN_REVIEW,
      updated_at: new Date().toISOString(),
    } as any)
    .eq('id', taskIdNum);

  if (error) {
    console.error('Error assigning task:', error);
    return false;
  }

  return true;
}

/**
 * Submit approval after review
 */
export async function submitApproval(
  taskId: string,
  approved: boolean,
  feedback: string,
  editorId: string
): Promise<boolean> {
  try {
    const stage = approved ? ReviewStage.APPROVED : ReviewStage.REVISION_REQUESTED;

    const taskIdNum = Number(taskId);
    if (!Number.isFinite(taskIdNum)) {
      throw new Error(`Invalid taskId (expected number): ${taskId}`);
    }
    const { error } = await supabase
      .from('review_tasks')
      .update({
        stage,
        feedback,
        decided_by: editorId,
        decided_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as any)
      .eq('id', taskIdNum);

    if (error) {
      console.error('Error submitting approval:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error submitting approval:', error);
    return false;
  }
}

/**
 * Get approval statistics
 */
export async function getApprovalStats(): Promise<{
  pending: number;
  inReview: number;
  approvedToday: number;
  rejectedToday: number;
  averageReviewTime: number; // hours
}> {
  try {
    const { data, error } = await supabase
      .from('review_tasks')
      .select('stage, created_at, decided_at');

    if (error || !data) {
      return {
        pending: 0,
        inReview: 0,
        approvedToday: 0,
        rejectedToday: 0,
        averageReviewTime: 0,
      };
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const pending = data.filter((item: any) => item.stage === ReviewStage.PENDING).length;
    const inReview = data.filter((item: any) => item.stage === ReviewStage.IN_REVIEW).length;
    const approvedToday = data.filter(
      (item: any) =>
        item.stage === ReviewStage.APPROVED &&
        new Date(item.decided_at || '') >= today
    ).length;
    const rejectedToday = data.filter(
      (item: any) =>
        item.stage === ReviewStage.REVISION_REQUESTED &&
        new Date(item.decided_at || '') >= today
    ).length;

    // Calculate average review time
    const decidedItems = data.filter((item: any) => item.decided_at);
    const totalReviewTime =
      decidedItems.reduce((sum: number, item: any) => {
        const created = new Date(item.created_at);
        const decided = new Date(item.decided_at || '');
        return sum + (decided.getTime() - created.getTime());
      }, 0) / (1000 * 60 * 60); // convert to hours

    const averageReviewTime = decidedItems.length > 0 ? totalReviewTime / decidedItems.length : 0;

    return {
      pending,
      inReview,
      approvedToday,
      rejectedToday,
      averageReviewTime: Math.round(averageReviewTime * 10) / 10,
    };
  } catch (error) {
    console.error('Error getting approval stats:', error);
    return {
      pending: 0,
      inReview: 0,
      approvedToday: 0,
      rejectedToday: 0,
      averageReviewTime: 0,
    };
  }
}

/**
 * Request revisions to content
 */
export async function requestRevisions(
  clipId: string,
  revisionNotes: string[],
  priority: 'low' | 'medium' | 'high' = 'medium'
): Promise<ReviewTask> {
  const issues: ReviewTask['issues'] = revisionNotes.map((note) => ({
    type: 'critical' as const,
    message: note,
  }));

  return createReviewTask(clipId, issues, priority);
}

/**
 * Archive completed review task
 */
export async function archiveReviewTask(taskId: string): Promise<boolean> {
  try {
    const taskIdNum = Number(taskId);
    if (!Number.isFinite(taskIdNum)) {
      throw new Error(`Invalid taskId (expected number): ${taskId}`);
    }
    const { error } = await supabase
      .from('review_tasks')
      .update({
        stage: ReviewStage.ARCHIVED,
        updated_at: new Date().toISOString(),
      } as any)
      .eq('id', taskIdNum);

    if (error) {
      console.error('Error archiving task:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error archiving task:', error);
    return false;
  }
}
