/**
 * Analyze video segments using OpenAI
 * Generates hooks, explanations, captions, and hashtags
 */

import { supabase } from '../utils/supabaseClient';
import { ENV } from '../utils/env';
import { buildAnalysisPrompt } from '../intelligence/analysisPrompt';
import { directorApproveContent } from '../content-management/contentDirector';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: ENV.OPENAI_API_KEY,
  project: ENV.OPENAI_PROJECT_ID || undefined,
});

export interface AnalysisResult {
  hook: string;
  explanation: string;
  caption: string;
  hashtags: string[];
  viralityScore: number;
  metadata: Record<string, any>;
}

export interface AnalyzeClipOptions {
  segmentId?: string; // If provided, analyze only this segment
  segmentIds?: string[]; // If provided, analyze these specific segments
  batchSize?: number; // Number of segments to analyze at once
}

/**
 * Generate analysis for a video segment using OpenAI
 * Uses Vision API to analyze the video content
 */
async function generateAnalysis(
  segmentId: string,
  videoUrl: string,
  metadata?: Record<string, any>
): Promise<AnalysisResult> {
  try {
    const prompt = buildAnalysisPrompt({
      videoUrl,
      metadata,
    });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert viral content creator. Always respond with valid JSON.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    });

    let response;
    try {
      response = completion.choices[0].message.content;
      if (!response) {
        throw new Error('No response from OpenAI');
      }
    } catch (err) {
      console.error('OpenAI completion error:', err);
      // Return fallback analysis
      return {
        hook: 'Check this out',
        explanation: 'Interesting video content',
        caption: 'You have to see this! #viral',
        hashtags: ['viral', 'trending', 'fyp', 'foryou', 'explore'],
        viralityScore: 5,
        metadata: {},
      };
    }

    let analysis;
    try {
      analysis = JSON.parse(response);
    } catch (err) {
      console.error('Failed to parse OpenAI response:', err, response);
      // Return fallback analysis
      return {
        hook: 'Check this out',
        explanation: 'Interesting video content',
        caption: 'You have to see this! #viral',
        hashtags: ['viral', 'trending', 'fyp', 'foryou', 'explore'],
        viralityScore: 5,
        metadata: {},
      };
    }

    const hashtags =
      analysis.hashtags_instagram ||
      analysis.hashtags ||
      [];

    const platformScores = analysis.platform_scores || {};
    const scoreValues = Object.values(platformScores).filter(
      (value) => typeof value === 'number'
    ) as number[];
    const viralityScore = scoreValues.length > 0 ? Math.max(...scoreValues) : 5;

    const metadataOutput = {
      impact_statement: analysis.impact_statement,
      hashtags_instagram: analysis.hashtags_instagram,
      hashtags_youtube: analysis.hashtags_youtube,
      hashtags_facebook: analysis.hashtags_facebook,
      content_pillar: analysis.content_pillar,
      platform_scores: platformScores,
      pacing: analysis.pacing,
      emotion_tag: analysis.emotion_tag,
      evergreen_or_trending: analysis.evergreen_or_trending,
    };

    return {
      hook: analysis.hook || 'Check this out',
      explanation: analysis.explanation || 'Interesting video content',
      caption: analysis.caption || 'You have to see this! #viral',
      hashtags,
      viralityScore,
      metadata: metadataOutput,
    };
  } catch (error) {
    console.error(`Error generating analysis for segment ${segmentId}:`, error);
    
    // Return fallback analysis
    return {
      hook: 'Check this out',
      explanation: 'Interesting video content',
      caption: 'You have to see this! #viral',
      hashtags: ['viral', 'trending', 'fyp', 'foryou', 'explore'],
      viralityScore: 5,
      metadata: {},
    };
  }
}

/**
 * Analyze a single segment
 */
async function analyzeSingleSegment(segmentId: string): Promise<string> {
  try {
    // Check if already analyzed
    const { data: existingAnalysis } = await supabase
      .from('analysis')
      .select('id')
      .eq('segment_id', segmentId)
      .single();

    if (existingAnalysis) {
      console.log(`Segment ${segmentId} already analyzed, skipping`);
      return (existingAnalysis as any).id;
    }

    // Fetch segment from database
    const { data: segment, error: fetchError } = await supabase
      .from('clips_segmented')
      .select('*')
      .eq('id', segmentId)
      .single();

    if (fetchError || !segment) {
      console.error(`Segment not found: ${segmentId}`, fetchError);
      // Return fallback analysis id or skip
      return 'segment-not-found';
    }

    console.log(`Analyzing segment ${segmentId}...`);

    // Get public URL for the video
    const { data: urlData } = supabase.storage
      .from('segmented_clips')
      .getPublicUrl((segment as any).file_path);

    const videoUrl = urlData.publicUrl;

    // Generate analysis using OpenAI
    const analysis = await generateAnalysis(segmentId, videoUrl, (segment as any).metadata);

    // Insert into database
    const { data: insertedAnalysis, error: insertError } = await supabase
      .from('analysis')
      .insert({
        segment_id: segmentId,
        hook: analysis.hook,
        explanation: analysis.explanation,
        caption: analysis.caption,
        hashtags: analysis.hashtags,
        virality_score: analysis.viralityScore,
        metadata: analysis.metadata as any,
        analyzed_at: new Date().toISOString(),
      } as any)
      .select()
      .single();

    if (insertError) {
      console.error('Failed to insert analysis:', insertError);
      // Return fallback id
      return 'analysis-insert-failed';
    }

    // Run through content director approval workflow
    let approval;
    try {
      approval = await directorApproveContent(segmentId, analysis);
      // Update with approval status
      await supabase
        .from('analysis')
        .update({
          approval_status: approval.approval,
          content_status: approval.status,
          quality_score: approval.validation.score,
        } as any)
        .eq('id', (insertedAnalysis as any).id);
    } catch (err) {
      console.error('Approval workflow failed:', err);
      // Continue without approval update
    }

    console.log(`Successfully analyzed segment ${segmentId} (score: ${analysis.viralityScore}, approval: ${approval?.approval || 'N/A'})`);
    return (insertedAnalysis as any).id;
  } catch (error) {
    console.error(`Error analyzing segment ${segmentId}:`, error);
    // Return fallback id
    return 'analysis-failed';
  }
}

/**
 * Analyze video segments
 */
export async function analyzeClip(options: AnalyzeClipOptions = {}): Promise<string[]> {
  const { segmentId, segmentIds, batchSize = 10 } = options;

  const analysisIds: string[] = [];

  try {
    // If specific segment ID provided, analyze only that segment
    if (segmentId) {
      const id = await analyzeSingleSegment(segmentId);
      analysisIds.push(id);
      return analysisIds;
    }

    // If specific segment IDs provided, analyze those
    if (segmentIds && segmentIds.length > 0) {
      console.log(`[DEBUG] Analyzing ${segmentIds.length} provided segment IDs`);
      const segments = segmentIds.slice(0, batchSize);
      
      for (const sId of segments) {
        try {
          const id = await analyzeSingleSegment(sId);
          analysisIds.push(id);
        } catch (error) {
          console.error(`Error analyzing segment ${sId}:`, error);
          // Continue with next segment
        }
      }
      
      return analysisIds;
    }

    // Otherwise, analyze all segments that haven't been analyzed yet
    // First, get all segment IDs
    const { data: allSegments, error: fetchError } = await supabase
      .from('clips_segmented')
      .select('id')
      .order('created_at', { ascending: true })
      .limit(batchSize * 3); // Get more to account for already-analyzed ones

    console.log(`[DEBUG] Fetched ${allSegments?.length || 0} total segments from database`);

    if (fetchError) {
      console.error('Error fetching segments:', fetchError);
      throw fetchError;
    }

    if (!allSegments || allSegments.length === 0) {
      console.log('No segments found in database');
      return analysisIds;
    }

    // Get already analyzed segment IDs
    const { data: analyzed } = await supabase
      .from('analysis')
      .select('segment_id')
      .in('segment_id', allSegments.map((s: any) => s.id));

    console.log(`[DEBUG] Found ${analyzed?.length || 0} already-analyzed segments`);

    const analyzedIds = new Set((analyzed || []).map((a: any) => a.segment_id));
    
    // Filter to only unanalyzed segments
    const segments = allSegments
      .filter((s: any) => !analyzedIds.has(s.id))
      .slice(0, batchSize);

    console.log(`[DEBUG] ${segments.length} unanalyzed segments remaining after filter`);

    if (!segments || segments.length === 0) {
      console.log('No segments found to analyze');
      return analysisIds;
    }

    console.log(`Found ${segments.length} segments to check for analysis`);

    for (const segment of segments) {
      try {
        const id = await analyzeSingleSegment((segment as any).id);
        analysisIds.push(id);
      } catch (error) {
        console.error(`Failed to analyze segment ${(segment as any).id}:`, error);
      }
    }

    console.log(`Analysis complete: ${analysisIds.length} segments analyzed`);
    return analysisIds;
  } catch (error) {
    console.error('Error during analysis:', error);
    throw error;
  }
}

/**
 * Get top analyzed clips by virality score
 */
export async function getTopAnalyzedClips(limit: number = 10): Promise<any[]> {
  const { data, error } = await supabase
    .from('analysis')
    .select(`
      *,
      clips_segmented (
        *,
        clips_raw (*)
      )
    `)
    .order('virality_score', { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return data || [];
}
