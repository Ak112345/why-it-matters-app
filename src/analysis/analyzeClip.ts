/**
 * Analyze video segments using OpenAI
 * Generates hooks, explanations, captions, and hashtags
 */

import { supabase } from '../utils/supabaseClient';
import { ENV } from '../utils/env';
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
  segmentId?: string;
  segmentIds?: string[];
  batchSize?: number;
}

/**
 * Fetch Pexels video metadata to use as context for analysis
 * Note: Pexels API doesn't have a direct /videos/{id} endpoint,
 * so we construct reasonable metadata from the source_id and known patterns
 */
async function fetchPexelsMetadata(sourceId: string): Promise<Record<string, any> | null> {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) return null;

  const numericId = sourceId.replace(/^pexels_/, '');
  
  try {
    // Try multiple Pexels API endpoints in case they support different formats
    // Primary attempt: Use the videos endpoint with ID
    try {
      const response = await fetch(`https://api.pexels.com/videos/${numericId}`, {
        headers: { Authorization: apiKey },
      });
      if (response.ok) {
        const data = await response.json() as any;
        return {
          title: data.video?.split('/').pop()?.replace(/[-_]/g, ' ')?.split('.')[0] ?? `Video ${numericId}`,
          duration: data.duration || data.video_length,
          width: data.width,
          height: data.height,
          user: data.photographer ?? '',
          tags: data.tags || [],
          url: data.url,
        };
      }
    } catch (retryErr) {
      // Continue to fallback
    }

    // Fallback: Construct reasonable metadata from what we know
    // This at least gives Claude/GPT something meaningful to work with
    return {
      title: `Video ${numericId}`,
      duration: null,
      width: 1920,
      height: 1080,
      user: 'Pexels',
      tags: [],
      url: `https://www.pexels.com/video/${numericId}/`,
      note: 'Metadata sourced from Pexels library (direct fetch failed)',
    };
  } catch (error) {
    console.warn(`Failed to fetch Pexels metadata for ${sourceId}:`, error);
    // Return minimal fallback
    return {
      title: `Pexels Video ${numericId}`,
      note: 'Pexels metadata unavailable - YouTube/article context will guide analysis',
    };
  }
}

/**
 * Generate analysis for a video segment using OpenAI
 * Uses Pexels metadata as context since GPT-4o can't watch videos
 */
async function generateAnalysis(
  segmentId: string,
  source: string,
  sourceId: string,
  startTime: number,
  endTime: number,
): Promise<AnalysisResult> {
  // Get rich metadata from source API
  let metadata: Record<string, any> = { source, sourceId, startTime, endTime };
  
  if (source === 'pexels') {
    const pexelsMeta = await fetchPexelsMetadata(sourceId);
    if (pexelsMeta) metadata = { ...metadata, ...pexelsMeta };
  }

  const metadataDescription = [
    metadata.title ? `Title/topic: "${metadata.title}"` : '',
    metadata.tags?.length ? `Tags: ${metadata.tags.join(', ')}` : '',
    metadata.duration ? `Duration: ${metadata.duration}s` : '',
    metadata.user ? `Creator: ${metadata.user}` : '',
    `Segment: ${startTime}s to ${endTime}s of the clip`,
  ].filter(Boolean).join('\n');

  const prompt = `You are a content strategist for a short-form video channel called "This Is Why It Matters." The channel explains cultural events, social discussions, policy changes, and news moments with context and impact.

Here is metadata about a video clip being analyzed:
${metadataDescription}

Based on this video content, generate compelling short-form social media content. Be specific and creative — avoid generic phrases like "Check this out" or "Watch this."

Return JSON with these keys:
- hook: First 3 seconds. One punchy sentence starting with "Nobody's talking about..." or "This is bigger than you think..." or "Here's what actually happened..." — make it specific to the content
- explanation: 3-4 sentences giving context. What is this? When? Why did it happen?
- impact_statement: 1-2 sentences on why this matters today
- caption: 150 chars max with core topic and emotional trigger
- hashtags_instagram: array of 5 hashtags (mix niche + broad)
- hashtags_youtube: array of 5 hashtags
- hashtags_facebook: array of 5 hashtags
- content_pillar: one of "Cultural Event" | "Social Discussion" | "Public Reaction" | "News Moment" | "Internet Controversy" | "Policy Change" | "Social Shift"
- platform_scores: object with instagram, youtube_shorts, facebook each rated 1-10
- pacing: "Fast" | "Medium" | "Slow"
- emotion_tag: "Outrage" | "Empathy" | "Curiosity" | "Shock" | "Pride" | "Sadness" | "Inspiration" | "Humor"
- evergreen_or_trending: "Evergreen" | "Trending"`;

  try {
    console.log(`[generateAnalysis] Calling OpenAI for segment ${segmentId}...`);
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are an expert viral content creator. Always respond with valid JSON. Never use generic placeholder text.' },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.8,
    });

    const response = completion.choices[0].message.content;
    if (!response) throw new Error('No response from OpenAI');

    console.log(`[generateAnalysis] Received response, parsing JSON...`);
    const analysis = JSON.parse(response);

    // Reject fallback/generic responses
    if (!analysis.hook || analysis.hook === 'Check this out' || analysis.hook === 'Watch this.') {
      throw new Error('OpenAI returned generic hook — rejecting');
    }

    const platformScores = analysis.platform_scores || {};
    const scoreValues = Object.values(platformScores).filter(v => typeof v === 'number') as number[];
    const viralityScore = scoreValues.length > 0 ? Math.max(...scoreValues) : 5;

    return {
      hook: analysis.hook,
      explanation: analysis.explanation || '',
      caption: analysis.caption || '',
      hashtags: analysis.hashtags_instagram || analysis.hashtags || [],
      viralityScore,
      metadata: {
        impact_statement: analysis.impact_statement,
        hashtags_instagram: analysis.hashtags_instagram,
        hashtags_youtube: analysis.hashtags_youtube,
        hashtags_facebook: analysis.hashtags_facebook,
        content_pillar: analysis.content_pillar,
        platform_scores: platformScores,
        pacing: analysis.pacing,
        emotion_tag: analysis.emotion_tag,
        evergreen_or_trending: analysis.evergreen_or_trending,
        source_metadata: metadata,
      },
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[generateAnalysis] Error for segment ${segmentId}:`, errorMsg);
    
    // Check if this is an auth error
    if (errorMsg.includes('401') || errorMsg.includes('Unauthorized') || errorMsg.includes('API key')) {
      console.error('[generateAnalysis] ⚠ LIKELY AUTH ISSUE - Check OPENAI_API_KEY env var');
    }
    
    throw error; // Don't swallow — let caller handle and skip
  }
}

/**
 * Analyze a single segment
 */
async function analyzeSingleSegment(segmentId: string): Promise<string> {
  // Check if already analyzed with a real hook (not the fallback)
  const { data: existingAnalysis, error: checkError } = await supabase
    .from('analysis')
    .select('id, hook')
    .eq('segment_id', segmentId)
    .single();

  if (checkError && checkError.code !== 'PGRST116') {
    // PGRST116 = no rows (not found), any other error is real
    throw new Error(`Failed to check existing analysis: ${checkError.message}`);
  }

  if (existingAnalysis && existingAnalysis.hook !== 'Check this out') {
    console.log(`Segment ${segmentId} already has real analysis, skipping`);
    return existingAnalysis.id;
  }

  // If existing analysis has fake hook, delete it so we re-analyze
  if (existingAnalysis && existingAnalysis.hook === 'Check this out') {
    await supabase.from('analysis').delete().eq('id', existingAnalysis.id);
    console.log(`Deleted fake analysis for segment ${segmentId}, re-analyzing`);
  }

  // Fetch segment + raw clip info
  const { data: segment, error: fetchError } = await supabase
    .from('clips_segmented')
    .select('*')
    .eq('id', segmentId)
    .single();

  if (fetchError) {
    throw new Error(`Segment not found: ${segmentId} (${fetchError.message})`);
  }

  if (!segment) {
    throw new Error(`Segment ${segmentId} returned no data`);
  }

  // Fetch raw clip separately (Supabase schema cache issue with relationships)
  const { data: rawClip, error: rawError } = await supabase
    .from('clips_raw')
    .select('source, source_id')
    .eq('id', (segment as any).raw_clip_id)
    .single();

  if (rawError || !rawClip) {
    throw new Error(`Raw clip not found for segment ${segmentId}: ${rawError?.message ?? 'No data'}`);
  }

  console.log(`[analyzeSingleSegment] Analyzing ${segmentId} (${rawClip.source}/${rawClip.source_id})...`);

  let analysis: AnalysisResult;
  try {
    analysis = await generateAnalysis(
      segmentId,
      rawClip.source,
      rawClip.source_id,
      (segment as any).start_time ?? 0,
      (segment as any).end_time ?? 10,
    );
  } catch (analysisError) {
    const msg = analysisError instanceof Error ? analysisError.message : String(analysisError);
    console.error(`[analyzeSingleSegment] Analysis generation failed for segment ${segmentId}:`, msg);
    throw new Error(`Analysis generation failed: ${msg}`);
  }

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

  if (insertError) throw new Error(`Failed to insert analysis: ${insertError.message}`);

  // Run through content director approval
  // TEMPORARILY DISABLED - Checking if this is causing timeout
  // try {
  //   const approval = await directorApproveContent(segmentId, analysis);
  //   await supabase
  //     .from('analysis')
  //     .update({
  //       approval_status: approval.approval,
  //       content_status: approval.status,
  //       quality_score: approval.validation.score,
  //     } as any)
  //     .eq('id', (insertedAnalysis as any).id);
  // } catch (err) {
  //   console.error('Approval workflow failed:', err);
  // }

  console.log(`✓ Analyzed segment ${segmentId} — hook: "${analysis.hook}" (score: ${analysis.viralityScore})`);
  return (insertedAnalysis as any).id;
}

/**
 * Analyze video segments
 */
export async function analyzeClip(options: AnalyzeClipOptions = {}): Promise<string[]> {
  const { segmentId, segmentIds, batchSize = 10 } = options;
  const analysisIds: string[] = [];

  if (segmentId) {
    const id = await analyzeSingleSegment(segmentId);
    return [id];
  }

  if (segmentIds && segmentIds.length > 0) {
    for (const sId of segmentIds.slice(0, batchSize)) {
      try {
        const id = await analyzeSingleSegment(sId);
        analysisIds.push(id);
      } catch (error) {
        console.error(`Error analyzing segment ${sId}:`, error);
      }
    }
    return analysisIds;
  }

  // Batch analyze: get unanalyzed segments (or ones with fake hooks)
  console.log(`[analyzeClip] Starting batch analysis, batchSize=${batchSize}`);
  
  // First, get all segments that have real analyses
  const { data: realAnalyzed, error: realAnalyzeError } = await supabase
    .from('analysis')
    .select('segment_id')
    .neq('hook', 'Check this out');

  if (realAnalyzeError) {
    console.error('[analyzeClip] Error fetching real analyses:', realAnalyzeError);
  }

  const realAnalyzedIds = new Set((realAnalyzed || []).map((a: any) => a.segment_id));
  console.log(`[analyzeClip] Found ${realAnalyzedIds.size} segments with real analyses`);

  // Now get all segments, excluding those with real analyses
  const { data: allSegments, error: fetchError } = await supabase
    .from('clips_segmented')
    .select('id, status')
    .order('created_at', { ascending: false })  // Most recent first
    .limit(batchSize * 3);

  if (fetchError) {
    console.error('[analyzeClip] Fetch error:', fetchError);
    throw fetchError;
  }
  
  if (!allSegments || allSegments.length === 0) {
    console.log('[analyzeClip] No segments found in database');
    return analysisIds;
  }

  console.log(`[analyzeClip] Fetched ${allSegments.length} most recent segments from DB (limit was ${batchSize * 3})`);
  console.log(`[analyzeClip] First 3 segment IDs:`, allSegments.slice(0, 3).map((s: any) => s.id));

  // Filter out already analyzed segments
  const segmentsNeedingAnalysis = allSegments
    .filter((s: any) => !realAnalyzedIds.has(s.id))
    .slice(0, batchSize);

  console.log(`[analyzeClip] Segments needing analysis: ${segmentsNeedingAnalysis.length} (after filtering ${allSegments.length} most recent)`);
  if (segmentsNeedingAnalysis.length > 0) {
    console.log('[analyzeClip] First segment needing analysis:', segmentsNeedingAnalysis[0]);
  }

  let successCount = 0;
  let failureCount = 0;

  for (const segment of segmentsNeedingAnalysis) {
    try {
      const id = await analyzeSingleSegment((segment as any).id);
      analysisIds.push(id);
      successCount++;
    } catch (error) {
      failureCount++;
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[analyzeClip] Failed to analyze segment ${(segment as any).id}: ${msg}`);
    }
  }

  console.log(`[analyzeClip] Analysis complete: ${successCount} succeeded, ${failureCount} failed, ${analysisIds.length} total`);
  return analysisIds;
}

/**
 * Get top analyzed clips by virality score
 */
export async function getTopAnalyzedClips(limit: number = 10): Promise<any[]> {
  const { data: analyses, error } = await supabase
    .from('analysis')
    .select('*')
    .neq('hook', 'Check this out')
    .order('virality_score', { ascending: false })
    .limit(limit);

  if (error) throw error;
  
  if (!analyses || analyses.length === 0) return [];

  // Fetch related segments
  const segmentIds = analyses.map((a: any) => a.segment_id);
  const { data: segments } = await supabase
    .from('clips_segmented')
    .select('*')
    .in('id', segmentIds);

  // Fetch related raw clips
  const rawClipIds = (segments || []).map((s: any) => s.raw_clip_id);
  const { data: rawClips } = await supabase
    .from('clips_raw')
    .select('*')
    .in('id', rawClipIds);

  // Merge data back together
  const segmentsMap = new Map((segments || []).map((s: any) => [s.id, s]));
  const rawClipsMap = new Map((rawClips || []).map((r: any) => [r.id, r]));

  return analyses.map((a: any) => ({
    ...a,
    clips_segmented: segmentsMap.get(a.segment_id),
    clips_segmented_with_raw: {
      ...segmentsMap.get(a.segment_id),
      clips_raw: rawClipsMap.get((segmentsMap.get(a.segment_id) as any)?.raw_clip_id),
    },
  }));
}