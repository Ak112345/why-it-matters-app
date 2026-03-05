/**
 * YouTube-specific virality analysis prompt
 * Scores long-form clips (30–60s) and generates hook + full description
 */

import { ENV } from '../utils/env';

export interface YouTubeAnalysis {
  hook: string;
  description: string;
  viralityScore: number;
  contentPillar: string;
  tags: string[];
  explanation: string;
}

export async function analyzeForYouTube(
  topic: string,
  query: string,
  duration: number
): Promise<YouTubeAnalysis | null> {
  if (!ENV.OPENAI_API_KEY) {
    console.warn('[youtubeAnalysis] OPENAI_API_KEY not set');
    return null;
  }

  const prompt = `You are a YouTube content strategist for "Why It Matters" — a news explainer channel that makes complex real-world issues accessible and urgent.

A video clip has been sourced from the topic area: "${topic}" (search: "${query}", duration: ${duration}s).

Generate a YouTube video analysis with the following JSON structure:

{
  "hook": "A punchy, curiosity-driven title (max 80 chars). Must be specific and urgent. No clickbait. No generic openers.",
  "description": "A 3–4 sentence YouTube description. First sentence hooks the viewer. Second explains the core issue. Third gives context or stakes. Fourth is a call to action. Max 400 chars total.",
  "viralityScore": <integer 1–100, based on topic relevance, urgency, and shareability>,
  "contentPillar": "<one of: Policy Change | Cultural Event | Internet Controversy | News Moment | Public Reaction | Social Discussion | Social Shift>",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "explanation": "One sentence explaining why this topic matters right now (shown on screen in context bar, max 120 chars)"
}

Rules:
- Hook must NOT start with "Nobody's talking about", "This is why", or "Here's why"
- Hook must feel like a real breaking news headline
- Tags must be specific (not just "news" or "viral")
- viralityScore above 70 means it should be posted immediately
- Respond with valid JSON only, no markdown, no preamble`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ENV.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!res.ok) {
      console.error(`[youtubeAnalysis] OpenAI error ${res.status}`);
      return null;
    }

    const data: any = await res.json();
    const text = data.choices?.[0]?.message?.content || '';
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed: YouTubeAnalysis = JSON.parse(clean);

    console.log(`[youtubeAnalysis] Score: ${parsed.viralityScore} | Hook: ${parsed.hook}`);
    return parsed;
  } catch (err: any) {
    console.error('[youtubeAnalysis] Failed:', err.message);
    return null;
  }
}