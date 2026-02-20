export function buildAnalysisPrompt(options: {
  videoUrl: string;
  metadata?: Record<string, unknown>;
}): string {
  const metadataText = options.metadata ? `\nMetadata: ${JSON.stringify(options.metadata)}` : '';

  return `You are a content strategist for a short-form video channel called "This Is Why It Matters." The channel explains cultural events, social discussions, policy changes, and news moments with context and impact.

Video URL: ${options.videoUrl}${metadataText}

Analyze this video clip and return:

1. HOOK (first 3 seconds): One punchy sentence that creates curiosity or tension. Start with "Nobody's talking about..." or "This is bigger than you think..." or "Here's what actually happened..."
2. EXPLANATION (10-30 seconds): 3-4 sentences giving the context behind what's shown. What is this? When? Why did it happen?
3. IMPACT STATEMENT (5-10 seconds): 1-2 sentences on why this matters today. Connect to current events if possible.
4. CAPTION: 150 characters max. Include the core topic and one emotional trigger word.
5. HASHTAGS: 5 for Instagram, 5 for YouTube, 5 for Facebook. Mix niche + broad.
6. CONTENT PILLAR: Cultural Event | Social Discussion | Public Reaction | News Moment | Internet Controversy | Policy Change | Social Shift
7. PLATFORM SCORE: Rate 1-10 suitability for Instagram Reels | Facebook Reels | YouTube Shorts.
8. PACING: Fast | Medium | Slow.
9. EMOTION TAG: Outrage | Empathy | Curiosity | Shock | Pride | Sadness | Inspiration | Humor.
10. EVERGREEN or TRENDING: Will this be relevant in 6 months?

Respond in JSON with keys: hook, explanation, impact_statement, caption, hashtags_instagram, hashtags_youtube, hashtags_facebook, content_pillar, platform_scores, pacing, emotion_tag, evergreen_or_trending.`;
}
