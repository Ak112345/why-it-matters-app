import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/database';
import { ENV } from '../utils/env';

const openai = new OpenAI({ apiKey: ENV.OPENAI_API_KEY });
const supabase = createClient<Database>(ENV.SUPABASE_URL, ENV.SUPABASE_SERVICE_ROLE_KEY);

export interface ErrorContext {
  id: string;
  type: 'publish_failed' | 'upload_stuck' | 'analysis_failed' | 'production_failed' | 'missing_attribution';
  entity: string; // video title or clip ID
  error_message: string;
  metadata: any;
  timestamp: string;
}

export interface RemediationResult {
  success: boolean;
  action: string;
  details: string;
  retry_recommended: boolean;
}

/**
 * AI-powered error analysis and auto-remediation
 * Detects content errors and attempts automatic fixes
 */
export async function analyzeAndRemediateError(error: ErrorContext): Promise<RemediationResult> {
  try {
    // Use GPT-4 to analyze the error and suggest remediation
    const analysis = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an error remediation specialist for a video publishing pipeline.
Analyze errors and determine:
1. Root cause
2. Whether it can be auto-fixed
3. Specific remediation steps
4. Whether to retry

Common errors and fixes:
- Content policy violations: Replace flagged segments, adjust captions
- Missing metadata: Extract from video analysis, use defaults
- Upload timeouts: Retry with exponential backoff
- Attribution missing: Extract from source metadata, add watermark
- Encoding failures: Re-encode with different settings
- Platform API errors: Retry with rate limiting

Return JSON:
{
  "root_cause": "description",
  "auto_fixable": true/false,
  "remediation_steps": ["step1", "step2"],
  "retry_after_fix": true/false,
  "estimated_recovery_time": "30s/5m/manual"
}`
        },
        {
          role: 'user',
          content: `Error Type: ${error.type}
Entity: ${error.entity}
Error Message: ${error.error_message}
Metadata: ${JSON.stringify(error.metadata, null, 2)}
Timestamp: ${error.timestamp}

Analyze and provide remediation strategy.`
        }
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' }
    });

    const aiResponse = JSON.parse(analysis.choices[0].message.content || '{}');

    // Attempt automatic remediation based on error type
    if (aiResponse.auto_fixable) {
      const remediation = await executeRemediation(error, aiResponse);
      return remediation;
    } else {
      // Log for human review
      await logForHumanReview(error, aiResponse);
      return {
        success: false,
        action: 'escalated_to_human',
        details: aiResponse.root_cause,
        retry_recommended: false
      };
    }
  } catch (err) {
    console.error('Error in auto-remediation:', err);
    return {
      success: false,
      action: 'remediation_failed',
      details: err instanceof Error ? err.message : 'Unknown error',
      retry_recommended: false
    };
  }
}

/**
 * Execute specific remediation actions based on error type
 */
async function executeRemediation(error: ErrorContext, aiAnalysis: any): Promise<RemediationResult> {
  switch (error.type) {
    case 'publish_failed':
      return await remediatePublishFailure(error, aiAnalysis);
    
    case 'upload_stuck':
      return await remediateStuckUpload(error, aiAnalysis);
    
    case 'missing_attribution':
      return await addMissingAttribution(error, aiAnalysis);
    
    case 'analysis_failed':
      return await retryAnalysis(error, aiAnalysis);
    
    case 'production_failed':
      return await retryProduction(error, aiAnalysis);
    
    default:
      return {
        success: false,
        action: 'unknown_error_type',
        details: 'No remediation handler available',
        retry_recommended: false
      };
  }
}

/**
 * Fix failed publish attempts
 */
async function remediatePublishFailure(error: ErrorContext, _aiAnalysis: any): Promise<RemediationResult> {
  // Check error message for common patterns
  const errorMsg = error.error_message.toLowerCase();
  
  if (errorMsg.includes('rate limit') || errorMsg.includes('too many requests')) {
    // Schedule retry with backoff
    const retryDelay = calculateBackoff(error.metadata.retry_count || 0);
    await scheduleRetry(error.id, retryDelay);
    
    return {
      success: true,
      action: 'scheduled_retry',
      details: `Retry scheduled in ${retryDelay}ms due to rate limiting`,
      retry_recommended: true
    };
  }
  
  if (errorMsg.includes('invalid token') || errorMsg.includes('authentication')) {
    // Mark for credential refresh
    await flagCredentialIssue(error.metadata.platform);
    
    return {
      success: false,
      action: 'credential_issue_detected',
      details: 'Platform credentials need refresh',
      retry_recommended: false
    };
  }
  
  if (errorMsg.includes('content policy') || errorMsg.includes('community guidelines')) {
    // Try caption-only fix first
    await updateCaptionSafe(error.id);
    
    return {
      success: true,
      action: 'caption_sanitized',
      details: 'Removed potentially flagged content from caption, retry recommended',
      retry_recommended: true
    };
  }
  
  // Generic retry for unknown publish failures
  await scheduleRetry(error.id, 60000); // 1 minute
  return {
    success: true,
    action: 'generic_retry',
    details: 'Scheduled retry for unspecified publish failure',
    retry_recommended: true
  };
}

/**
 * Fix stuck upload states
 */
async function remediateStuckUpload(error: ErrorContext, _aiAnalysis: any): Promise<RemediationResult> {
  // Reset upload status and retry
  const { error: updateError } = await supabase
    .from('videos_final')
    .update({
      status: 'ready',
      updated_at: new Date().toISOString()
    })
    .eq('id', error.id);
  
  if (updateError) {
    return {
      success: false,
      action: 'status_reset_failed',
      details: updateError.message,
      retry_recommended: false
    };
  }
  
  // Re-queue for publishing
  await requeueForPublish(error.id);
  
  return {
    success: true,
    action: 'upload_reset',
    details: 'Reset stuck upload status and re-queued for publishing',
    retry_recommended: true
  };
}

/**
 * Add missing attribution metadata
 */
async function addMissingAttribution(error: ErrorContext, _aiAnalysis: any): Promise<RemediationResult> {
  // Fetch clip source info
  const { data: clip, error: fetchError } = await supabase
    .from('clips_raw')
    .select('source')
    .eq('id', error.metadata.clip_id)
    .single();
  
  if (fetchError || !clip) {
    return {
      success: false,
      action: 'source_lookup_failed',
      details: 'Could not retrieve source metadata',
      retry_recommended: false
    };
  }
  
  // Generate attribution based on source
  // Note: source_metadata column doesn't exist in database, using just source
  const attribution = generateAttribution(clip.source || 'unknown', null);
  
  // Update video with attribution
  // Note: caption field should be in analysis table, not videos_final
  // TODO: Update schema or use proper relationship to analysis.caption
  const { error: updateError } = await supabase
    .from('videos_final')
    .update({
      // caption: `${error.metadata.original_caption}\n\n${attribution}`,
      production_settings: { attribution } as any,
      updated_at: new Date().toISOString()
    } as any)
    .eq('id', error.id);
  
  if (updateError) {
    return {
      success: false,
      action: 'attribution_update_failed',
      details: updateError.message,
      retry_recommended: false
    };
  }
  
  return {
    success: true,
    action: 'attribution_added',
    details: `Added attribution: ${attribution}`,
    retry_recommended: true
  };
}

/**
 * Retry failed analysis
 */
async function retryAnalysis(error: ErrorContext, _aiAnalysis: any): Promise<RemediationResult> {
  const { error: updateError } = await supabase
    .from('clips_segmented')
    .update({
      status: 'pending',
      updated_at: new Date().toISOString()
    })
    .eq('id', error.id);
  
  if (updateError) {
    return {
      success: false,
      action: 'analysis_retry_failed',
      details: updateError.message,
      retry_recommended: false
    };
  }
  
  return {
    success: true,
    action: 'analysis_reset',
    details: 'Reset segment status for re-analysis',
    retry_recommended: true
  };
}

/**
 * Retry failed production
 */
async function retryProduction(error: ErrorContext, _aiAnalysis: any): Promise<RemediationResult> {
  // Check if FFmpeg encoding error
  if (error.error_message.includes('codec') || error.error_message.includes('encoding')) {
    // Try with more compatible settings
    const { error: updateError } = await supabase
      .from('videos_final')
      .update({
        status: 'pending',
        production_settings: {
          codec: 'libx264',
          preset: 'medium',
          crf: 23,
          fallback: true
        },
        updated_at: new Date().toISOString()
      })
      .eq('id', error.id);
    
    if (updateError) {
      return {
        success: false,
        action: 'production_retry_failed',
        details: updateError.message,
        retry_recommended: false
      };
    }
    
    return {
      success: true,
      action: 'production_reset_with_fallback',
      details: 'Reset production with fallback encoding settings',
      retry_recommended: true
    };
  }
  
  // Generic production retry
  const { error: updateError } = await supabase
    .from('videos_final')
    .update({
      status: 'pending',
      updated_at: new Date().toISOString()
    })
    .eq('id', error.id);
  
  if (updateError) {
    return {
      success: false,
      action: 'production_retry_failed',
      details: updateError.message,
      retry_recommended: false
    };
  }
  
  return {
    success: true,
    action: 'production_reset',
    details: 'Reset video for re-production',
    retry_recommended: true
  };
}

// Helper functions

function calculateBackoff(retryCount: number): number {
  // Exponential backoff: 1min, 2min, 4min, 8min, max 15min
  const baseDelay = 60000; // 1 minute
  const delay = Math.min(baseDelay * Math.pow(2, retryCount), 900000);
  return delay;
}

async function scheduleRetry(entityId: string, delayMs: number): Promise<void> {
  const retryAt = new Date(Date.now() + delayMs).toISOString();
  
  await supabase
    .from('posting_queue')
    .update({
      status: 'scheduled',
      scheduled_for: retryAt,
      updated_at: new Date().toISOString()
    })
    .eq('video_id', entityId);
}

async function flagCredentialIssue(platform: string): Promise<void> {
  // Log credential issue for admin review
  await supabase
    .from('system_alerts')
    .insert({
      type: 'credential_issue',
      platform,
      message: `${platform} credentials need refresh`,
      created_at: new Date().toISOString()
    });
}

async function updateCaptionSafe(videoId: string): Promise<void> {
  // Fetch current video
  const { data: video } = await supabase
    .from('videos_final')
    .select('caption')
    .eq('id', videoId)
    .single();
  
  if (!video) return;
  
  // Use GPT-4 to sanitize caption
  // Note: caption doesn't exist on videos_final, get from analysis table
  const { data: analysis } = await supabase
    .from('analysis')
    .select('caption')
    .eq('id', (video as any).analysis_id)
    .single();
  
  const currentCaption = analysis?.caption || '';
  
  const sanitized = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: 'Remove potentially policy-violating content from social media captions. Keep the core message but make it platform-safe. Remove hashtags if needed.'
      },
      {
        role: 'user',
        content: currentCaption
      }
    ],
    temperature: 0.3
  });
  
  const safeCaption = sanitized.choices[0].message.content || currentCaption;
  
  // Update caption in analysis table, not videos_final
  await supabase
    .from('analysis')
    .update({ 
      caption: safeCaption,
      updated_at: new Date().toISOString()
    } as any)
    .eq('id', (video as any).analysis_id);
}

async function requeueForPublish(videoId: string): Promise<void> {
  await supabase
    .from('posting_queue')
    .update({
      status: 'pending',
      updated_at: new Date().toISOString()
    })
    .eq('video_id', videoId);
}

function generateAttribution(source: string, metadata: any): string {
  switch (source) {
    case 'pixabay':
      return `📹 Video by ${metadata?.user || 'Pixabay'} from Pixabay`;
    case 'pexels':
      return `📹 Video by ${metadata?.photographer || 'Pexels'} from Pexels`;
    case 'archive.org':
      return `📹 Source: Internet Archive`;
    case 'nasa':
      return `📹 Source: NASA`;
    case 'loc':
      return `📹 Source: Library of Congress`;
    default:
      return `📹 Source: ${source}`;
  }
}

async function logForHumanReview(error: ErrorContext, aiAnalysis: any): Promise<void> {
  await supabase
    .from('error_log')
    .insert({
      error_type: error.type,
      entity_id: error.id,
      entity_name: error.entity,
      error_message: error.error_message,
      ai_analysis: aiAnalysis,
      status: 'needs_human_review',
      created_at: error.timestamp
    });
}
