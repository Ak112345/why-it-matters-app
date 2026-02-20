/**
 * Content Director - Main Orchestration Layer
 * Guides content through entire pipeline with quality gates and approval workflows
 */

import { supabase } from '../utils/supabaseClient';
// ENV import reserved for future feature flags or API keys
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { validateContent, ContentValidation } from './qualityAssurance';
import { ContentPillar, editorialCalendar, pillarGuidance } from './editorialGuidelines';

export enum ContentStatus {
  INGESTED = 'ingested',
  SEGMENTED = 'segmented',
  ANALYZED = 'analyzed', // Analysis complete, waiting QA
  QA_PENDING = 'qa_pending', // In quality assurance review
  APPROVED = 'approved', // Passed QA, ready for production
  REJECTED = 'rejected', // Failed QA, needs revision
  PRODUCED = 'produced', // Video produced, ready for scheduling
  QUEUED = 'queued', // Scheduled for posting
  PUBLISHED = 'published', // Posted to platforms
  ARCHIVED = 'archived', // Old, not being actively promoted
}

export enum ApprovalLevel {
  AUTOMATIC = 'automatic', // Passed automated QA
  EDITOR_REVIEW = 'editor_review', // Needs human review
  REJECTED = 'rejected', // Doesn't meet standards
}

export interface ContentTracker {
  id: string;
  status: ContentStatus;
  approval: ApprovalLevel;
  validation: ContentValidation | null;
  contentPillar?: ContentPillar;
  viralityScore: number;
  qualityScore: number;
  direction: string[]; // Notes from content director
  lastUpdated: Date;
  approvedBy?: string;
  approvedAt?: Date;
}

export interface DirectorGuidance {
  criticalFixes: string[];
  suggestedEdits: string[];
  contentPillarRecommendation: ContentPillar;
  platformStrategy: {
    platform: 'instagram' | 'facebook' | 'youtube_shorts';
    emphasis: string;
    hashtags: string[];
    postingTime: string;
  }[];
  nextSteps: string[];
}

/**
 * Run automated validation and route content appropriately
 */
export async function directorApproveContent(
  clipId: string,
  analysisData: {
    hook: string;
    explanation: string;
    caption: string;
    hashtags: string[];
    viralityScore: number;
    metadata: Record<string, any>;
  }
): Promise<{
  status: ContentStatus;
  approval: ApprovalLevel;
  validation: ContentValidation;
  guidance: DirectorGuidance;
}> {
  const validation = await validateContent(analysisData);
  const viralityScore = analysisData.viralityScore;

  // Determine content pillar from analysis metadata
  const detectedPillar = (analysisData.metadata?.content_pillar as ContentPillar) || 
                         ContentPillar.HISTORICAL_CONTEXT;

  let status: ContentStatus = ContentStatus.QA_PENDING;
  let approval: ApprovalLevel = ApprovalLevel.AUTOMATIC;
  const guidance: DirectorGuidance = generateDirectorGuidance(
    analysisData,
    validation,
    detectedPillar
  );

  // Decision logic (adjusted for more lenient approval)
  if (validation.isValid && validation.score >= 50) {
    // Medium-high quality - auto approve
    status = ContentStatus.APPROVED;
    approval = ApprovalLevel.AUTOMATIC;
  } else if (validation.score >= 35) {
    // Lower quality - needs review
    status = ContentStatus.QA_PENDING;
    approval = ApprovalLevel.EDITOR_REVIEW;
  } else {
    // Low quality - reject
    status = ContentStatus.REJECTED;
    approval = ApprovalLevel.REJECTED;
  }

  // Store in content tracker (or update if exists)
  await storeContentDirection(clipId, {
    status,
    approval,
    validation,
    contentPillar: detectedPillar,
    viralityScore,
    qualityScore: validation.score,
    direction: guidance.criticalFixes,
  });

  return {
    status,
    approval,
    validation,
    guidance,
  };
}

/**
 * Generate specific guidance for content production team
 */
function generateDirectorGuidance(
  analysisData: Record<string, any>,
  validation: ContentValidation,
  pillar: ContentPillar
): DirectorGuidance {
  const criticalFixes: string[] = [];
  const suggestedEdits: string[] = [];
  const platformStrategy: DirectorGuidance['platformStrategy'] = [];

  // Hook strength guidance
  if (validation.metadata.hookStrength < 6) {
    criticalFixes.push('CRITICAL: Rewrite hook with more compelling language');
  } else if (validation.metadata.hookStrength < 8) {
    suggestedEdits.push('Consider strengthening hook to increase click-through');
  }

  // Sensationalism check
  if (validation.metadata.sensationalismScore > 4) {
    criticalFixes.push('Reduce sensational language. Tone must be measured and credible.');
  }

  // Platform-specific guidance
  const pillarInfo = pillarGuidance[pillar];
  
  platformStrategy.push({
    platform: 'instagram',
    emphasis: pillarInfo.goalStoryType,
    hashtags: [
      `#${pillar.toLowerCase().replace(/_/g, '')}`,
      '#newsmatters',
      '#documentaryshorts',
      ...analysisData.hashtags_instagram?.slice(0, 5) || [],
    ].slice(0, 8),
    postingTime: '18:00 UTC',
  });

  platformStrategy.push({
    platform: 'facebook',
    emphasis: 'Deeper context and discussion potential',
    hashtags: analysisData.hashtags_facebook?.slice(0, 5) || [],
    postingTime: '14:00 UTC',
  });

  platformStrategy.push({
    platform: 'youtube_shorts',
    emphasis: 'Hook-driven discovery',
    hashtags: analysisData.hashtags_youtube?.slice(0, 3) || [],
    postingTime: '12:00 UTC',
  });

  const nextSteps = [
    'QA validation complete',
    'Ready for video production',
    'Apply platform specifications',
    'Schedule for distribution queue',
  ];

  if (suggestedEdits.length > 0) {
    nextSteps.unshift('Address suggested edits');
  }

  if (criticalFixes.length > 0) {
    nextSteps.unshift('REVIEW CRITICAL FIXES BEFORE PROCEEDING');
  }

  return {
    criticalFixes,
    suggestedEdits,
    contentPillarRecommendation: pillar,
    platformStrategy,
    nextSteps,
  };
}

/**
 * Store content direction in database or tracking system
 */
async function storeContentDirection(
  clipId: string,
  tracker: Omit<ContentTracker, 'id' | 'lastUpdated'>
): Promise<void> {
  try {
    // Assuming a 'content_direction' table exists in Supabase
    const { error } = await supabase.from('content_direction').upsert(
      {
        clip_id: clipId,
        status: tracker.status,
        approval_level: tracker.approval,
        validation_score: tracker.qualityScore,
        content_pillar: tracker.contentPillar,
        virality_score: tracker.viralityScore,
        direction_notes: tracker.direction as any,
        validation_details: tracker.validation as any,
        updated_at: new Date().toISOString(),
      } as any,
      { onConflict: 'clip_id' }
    );

    if (error) {
      console.error('Error storing content direction:', error);
    }
  } catch (error) {
    console.error('Error storing content direction:', error);
  }
}

/**
 * Get director's brief on all pending content
 */
export async function getDirectorBrief(): Promise<{
  totalPending: number;
  criticalIssues: number;
  readyForProduction: number;
  byPillar: Record<ContentPillar, number>;
  upcomingQuota: number;
}> {
  try {
    // Query for content status breakdown
    const { data, error } = await supabase
      .from('content_direction')
      .select('status, content_pillar, validation_score');

    if (error || !data) {
      return {
        totalPending: 0,
        criticalIssues: 0,
        readyForProduction: 0,
        byPillar: Object.values(ContentPillar).reduce(
          (acc, pillar) => ({ ...acc, [pillar]: 0 }),
          {} as Record<ContentPillar, number>
        ),
        upcomingQuota: 5,
      };
    }

    const pending = data.filter((item: any) => item.status === ContentStatus.QA_PENDING).length;
    const critical = data.filter(
      (item: any) => item.validation_score < 50 && item.status !== ContentStatus.REJECTED
    ).length;
    const readyForProduction = data.filter(
      (item: any) => item.status === ContentStatus.APPROVED
    ).length;

    const byPillar: Record<ContentPillar, number> = Object.values(ContentPillar).reduce(
      (acc, pillar) => ({
        ...acc,
        [pillar]: data.filter((item: any) => item.content_pillar === pillar).length,
      }),
      {} as Record<ContentPillar, number>
    );

    return {
      totalPending: pending,
      criticalIssues: critical,
      readyForProduction,
      byPillar,
      upcomingQuota: 5,
    };
  } catch (error) {
    console.error('Error getting director brief:', error);
    return {
      totalPending: 0,
      criticalIssues: 0,
      readyForProduction: 0,
      byPillar: Object.values(ContentPillar).reduce(
        (acc, pillar) => ({ ...acc, [pillar]: 0 }),
        {} as Record<ContentPillar, number>
      ),
      upcomingQuota: 5,
    };
  }
}

/**
 * Get weekly content strategy based on editorial calendar
 */
export function getWeeklyStrategy(weekNumber: number): {
  theme: string;
  focusPillars: ContentPillar[];
  targetCount: number;
  guidance: string;
} {
  const week = weekNumber % editorialCalendar.length;
  const strategy = editorialCalendar[week];

  return {
    theme: strategy.theme,
    focusPillars: strategy.focusPillars,
    targetCount: strategy.numberOfPosts,
    guidance: strategy.description,
  };
}
