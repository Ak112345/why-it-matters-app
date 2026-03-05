export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import { fetchPexelsLongClip } from '../../../../src/ingestion/fetchSources/pexelsLong';
import { fetchPixabayLongClip } from '../../../../src/ingestion/fetchSources/pixabayLong';
import { analyzeForYouTube } from '../../../../src/intelligence/youtubeAnalysisPrompt';
import { produceYouTubeVideo, saveYouTubeAnalysis } from '../../../../src/production/produceYouTubeVideo';

const YOUTUBE_TOPICS: Record<string, string[]> = {
  'Society & Human Impact': ['city life', 'community', 'people working', 'urban development'],
  'Technology & Future':    ['technology', 'innovation', 'digital world', 'artificial intelligence'],
  'Economy & Money':        ['business', 'stock market', 'economy', 'financial district'],
  'Environment & Earth':    ['climate', 'nature', 'environment', 'ocean'],
  'Power & Politics':       ['government', 'protest', 'democracy', 'city hall'],
  'Health & Science':       ['medical research', 'hospital', 'science lab', 'public health'],
};

async function fetchLongClip(query: string, topic: string) {
  // Try Pexels first, fall back to Pixabay
  const pexels = await fetchPexelsLongClip(query, topic);
  if (pexels) return pexels;

  const pixabay = await fetchPixabayLongClip(query, topic);
  if (pixabay) return pixabay;

  return null;
}

export async function GET() {
  try {
    console.log('[YOUTUBE GENERATE] Starting YouTube content generation...');

    const results = [];

    // Pick a random topic
    const topics = Object.keys(YOUTUBE_TOPICS);
    const topic = topics[Math.floor(Math.random() * topics.length)];
    const queries = YOUTUBE_TOPICS[topic];

    console.log(`[YOUTUBE GENERATE] Topic: "${topic}"`);

    let clip = null;
    let usedQuery = '';

    // Try each query until we find a clip
    for (const query of queries) {
      clip = await fetchLongClip(query, topic);
      if (clip) {
        usedQuery = query;
        break;
      }
    }

    if (!clip) {
      return NextResponse.json({
        success: false,
        error: `No suitable 30–60s clip found for topic: ${topic}`,
        topic,
      }, { status: 404 });
    }

    console.log(`[YOUTUBE GENERATE] Clip found: ${clip.sourceId} (${clip.duration}s)`);

    // Analyze for YouTube virality
    const analysis = await analyzeForYouTube(topic, usedQuery, clip.duration);

    if (!analysis) {
      return NextResponse.json({
        success: false,
        error: 'YouTube analysis failed',
        topic,
        clip: clip.sourceId,
      }, { status: 500 });
    }

    if (analysis.viralityScore < 50) {
      console.log(`[YOUTUBE GENERATE] Low virality score (${analysis.viralityScore}) — skipping`);
      return NextResponse.json({
        success: false,
        message: `Virality score too low (${analysis.viralityScore}/100) — skipping this clip`,
        topic,
        hook: analysis.hook,
        viralityScore: analysis.viralityScore,
      }, { status: 200 });
    }

    // Save analysis to Supabase
    const analysisId = await saveYouTubeAnalysis(
      clip.sourceId,
      clip.duration,
      topic,
      usedQuery,
      analysis
    );

    if (!analysisId) {
      return NextResponse.json({
        success: false,
        error: 'Failed to save YouTube analysis to database',
      }, { status: 500 });
    }

    // Send to Railway worker for production
    const produceResult = await produceYouTubeVideo(
      clip.sourceId,
      clip.duration,
      analysis,
      analysisId
    );

    results.push({
      topic,
      query: usedQuery,
      sourceId: clip.sourceId,
      duration: clip.duration,
      hook: analysis.hook,
      viralityScore: analysis.viralityScore,
      analysisId,
      produced: produceResult.success,
      videoId: produceResult.videoId,
      error: produceResult.error,
    });

    console.log(`[YOUTUBE GENERATE] Complete — produced: ${produceResult.success}`);

    return NextResponse.json({
      success: true,
      message: `YouTube video generated for topic: ${topic}`,
      timestamp: new Date().toISOString(),
      topic,
      results,
    });

  } catch (error) {
    console.error('[YOUTUBE GENERATE] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const workerUrl = process.env.RAILWAY_WORKER_URL;
    const workerSecret = process.env.WORKER_SECRET;

    if (!workerUrl || !workerSecret) {
      return NextResponse.json(
        { error: 'Worker configuration missing' },
        { status: 500 }
      );
    }

    const body = await request.json();

    const response = await fetch(`${workerUrl}/produce-youtube`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-worker-secret': workerSecret,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error in /api/youtube/generate:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}