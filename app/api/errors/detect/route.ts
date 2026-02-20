import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/src/types/database';
import { ENV } from '@/src/utils/env';
import { analyzeAndRemediateError, ErrorContext } from '@/src/services/autoRemediate';

const supabase = createClient<Database>(ENV.SUPABASE_URL, ENV.SUPABASE_SERVICE_ROLE_KEY);

/**
 * Error Detection & Auto-Remediation Agent
 * Scans pipeline for failures and attempts automatic fixes
 * 
 * GET /api/errors/detect - Scan and remediate all pending errors
 * POST /api/errors/detect - Manually trigger remediation for specific error
 */

export async function GET() {
  try {
    const errors: ErrorContext[] = [];
    
    // 1. Detect failed publishes
    const { data: failedPublishes } = await supabase
      .from('posting_queue')
      .select(`
        id,
        video_id,
        platform,
        status,
        error_message,
        metadata,
        updated_at,
        videos_final (
          title,
          caption
        )
      `)
      .eq('status', 'failed')
      .order('updated_at', { ascending: false })
      .limit(10);
    
    if (failedPublishes) {
      for (const publish of failedPublishes) {
        const publishData = publish as any;
        const video = publishData.videos_final;
        
        errors.push({
          id: publishData.video_id,
          type: 'publish_failed',
          entity: video?.title || publishData.video_id,
          error_message: publishData.error_message || 'Unknown publish error',
          metadata: {
            ...publishData.metadata,
            platform: publishData.platform,
            publish_id: publishData.id,
            retry_count: publishData.metadata?.retry_count || 0
          },
          timestamp: publishData.updated_at
        });
      }
    }
    
    // 2. Detect stuck uploads
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: stuckUploads } = await supabase
      .from('videos_final')
      .select('id, title, status, updated_at, production_metadata')
      .in('status', ['uploading', 'processing'])
      .lt('updated_at', thirtyMinutesAgo)
      .limit(10);
    
    if (stuckUploads) {
      for (const video of stuckUploads) {
        const videoData = video as any;
        errors.push({
          id: videoData.id,
          type: 'upload_stuck',
          entity: videoData.title,
          error_message: `Upload stuck in '${videoData.status}' state for >30 minutes`,
          metadata: {
            status: videoData.status,
            production_metadata: videoData.production_metadata
          },
          timestamp: videoData.updated_at
        });
      }
    }
    
    // 3. Detect analysis failures
    const { data: failedAnalysis } = await supabase
      .from('clips_segmented')
      .select('id, status, error_message, updated_at, clips_raw (source, title)')
      .eq('status', 'failed')
      .order('updated_at', { ascending: false })
      .limit(10);
    
    if (failedAnalysis) {
      for (const segment of failedAnalysis) {
        const segmentData = segment as any;
        const clip = segmentData.clips_raw;
        
        errors.push({
          id: segmentData.id,
          type: 'analysis_failed',
          entity: clip?.title || segmentData.id,
          error_message: segmentData.error_message || 'Analysis failed',
          metadata: {
            source: clip?.source
          },
          timestamp: segmentData.updated_at
        });
      }
    }
    
    // 4. Detect missing attribution (Pixabay clips without attribution in caption)
    const { data: pixabayVideos } = await supabase
      .from('videos_final')
      .select(`
        id,
        title,
        caption,
        updated_at,
        clips_raw (
          source,
          source_metadata
        )
      `)
      .eq('clips_raw.source', 'pixabay')
      .limit(20);
    
    if (pixabayVideos) {
      for (const video of pixabayVideos) {
        const videoData = video as any;
        const caption = videoData.caption || '';
        
        // Check if attribution is missing
        if (!caption.includes('Pixabay') && !caption.includes('📹')) {
          errors.push({
            id: videoData.id,
            type: 'missing_attribution',
            entity: videoData.title,
            error_message: 'Pixabay video missing source attribution',
            metadata: {
              original_caption: caption,
              clip_id: videoData.clips_raw?.id,
              source_metadata: videoData.clips_raw?.source_metadata
            },
            timestamp: videoData.updated_at
          });
        }
      }
    }
    
    // 5. Detect production failures
    const { data: failedProduction } = await supabase
      .from('videos_final')
      .select('id, title, status, error_message, updated_at, production_metadata')
      .eq('status', 'failed')
      .order('updated_at', { ascending: false })
      .limit(10);
    
    if (failedProduction) {
      for (const video of failedProduction as any[]) {
        errors.push({
          id: video.id,
          type: 'production_failed',
          entity: video.title,
          error_message: video.error_message || 'Production failed',
          metadata: {
            production_metadata: video.production_metadata
          },
          timestamp: video.updated_at
        });
      }
    }
    
    // Auto-remediate each error
    const remediationResults = await Promise.all(
      errors.map(async (error) => {
        const result = await analyzeAndRemediateError(error);
        
        // Log remediation attempt
        const remediationLogEntry: Database['public']['Tables']['remediation_log']['Insert'] = {
          error_type: error.type,
          entity_id: error.id,
          entity_name: error.entity,
          error_message: error.error_message,
          remediation_action: result.action,
          remediation_success: result.success,
          remediation_details: result.details,
          retry_recommended: result.retry_recommended,
          manual_trigger: false,
          created_at: new Date().toISOString()
        };
        
        await supabase
          .from('remediation_log')
          .insert(remediationLogEntry);
        
        return {
          error,
          remediation: result
        };
      })
    );
    
    // Generate summary
    const summary = {
      total_errors: errors.length,
      auto_fixed: remediationResults.filter(r => r.remediation.success).length,
      needs_human_review: remediationResults.filter(r => !r.remediation.success).length,
      retry_scheduled: remediationResults.filter(r => r.remediation.retry_recommended).length
    };
    
    return NextResponse.json({
      summary,
      results: remediationResults,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error in detection agent:', error);
    return NextResponse.json(
      { 
        error: 'Detection failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Manually trigger remediation for a specific error
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { errorContext } = body as { errorContext: ErrorContext };
    
    if (!errorContext || !errorContext.type || !errorContext.id) {
      return NextResponse.json(
        { error: 'Invalid error context' },
        { status: 400 }
      );
    }
    
    // Attempt remediation
    const result = await analyzeAndRemediateError(errorContext);
    
    // Log remediation attempt
    const remediationLogEntry: Database['public']['Tables']['remediation_log']['Insert'] = {
      error_type: errorContext.type,
      entity_id: errorContext.id,
      entity_name: errorContext.entity,
      error_message: errorContext.error_message,
      remediation_action: result.action,
      remediation_success: result.success,
      remediation_details: result.details,
      retry_recommended: result.retry_recommended,
      manual_trigger: true,
      created_at: new Date().toISOString()
    };
    
    await supabase
      .from('remediation_log')
      .insert(remediationLogEntry);
    
    return NextResponse.json({
      success: result.success,
      result,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error in manual remediation:', error);
    return NextResponse.json(
      { 
        error: 'Remediation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
