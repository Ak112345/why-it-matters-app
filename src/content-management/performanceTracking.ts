/**
 * Content Performance Tracking & Analytics
 * Measures effectiveness and impact of posted content
 */

import { supabase } from '../utils/supabaseClient';

export interface ContentPerformanceMetrics {
  videoId: string;
  platform: 'instagram' | 'facebook' | 'youtube_shorts';
  metrics: {
    views: number;
    likes: number;
    comments: number;
    shares: number;
    saves: number;
    clicks: number;
    watchTime: number; // seconds
  };
  engagement: {
    engagementRate: number; // (likes + comments + shares) / views * 100
    interactionRate: number; // (likes + comments) / views * 100
    shareRate: number; // shares / views * 100
    clickRate: number; // clicks / views * 100
  };
  audience: {
    reachScore: number; // 0-100
    impressions: number;
    uniqueReaches: number;
    conversionRate: number; // clicks linking to educational content
  };
  sentiment: {
    scoreAverage: 0 | 1 | -1; // positive | neutral | negative
    topComments: string[];
    contentWarnings: string[];
  };
  estimatedImpact: {
    educationLevel: number; // 0-10, was content educational?
    shareabilityScore: number; // 0-10
    overallEffectiveness: number; // 0-100
  };
}

export interface AggregatedMetrics {
  period: {
    startDate: Date;
    endDate: Date;
    days: number;
  };
  totalVideos: number;
  platforms: {
    [key: string]: {
      videos: number;
      totalViews: number;
      avgEngagementRate: number;
      topPerformer: string;
    };
  };
  contentPillars: {
    [key: string]: {
      videos: number;
      avgViews: number;
      avgEngagementRate: number;
      bestPerformingPillar: boolean;
    };
  };
  trends: {
    bestPostingTime: string;
    bestContentType: string;
    audienceGrowth: number;
    viralityThreshold: number; // At what engagement rate content goes viral
  };
}

/**
 * Record performance metrics for a posted video
 */
export async function recordPerformanceMetrics(
  videoId: string,
  platform: 'instagram' | 'facebook' | 'youtube_shorts',
  rawMetrics: {
    views: number;
    likes: number;
    comments: number;
    shares: number;
    saves?: number;
    watchTime?: number;
    clicks?: number;
  }
): Promise<ContentPerformanceMetrics> {
  const metrics: ContentPerformanceMetrics['metrics'] = {
    views: rawMetrics.views || 0,
    likes: rawMetrics.likes || 0,
    comments: rawMetrics.comments || 0,
    shares: rawMetrics.shares || 0,
    saves: rawMetrics.saves || 0,
    clicks: rawMetrics.clicks || 0,
    watchTime: rawMetrics.watchTime || 0,
  };

  // Calculate engagement metrics
  const totalInteractions = metrics.likes + metrics.comments + metrics.shares;
  const engagement: ContentPerformanceMetrics['engagement'] = {
    engagementRate:
      metrics.views > 0 ? (totalInteractions / metrics.views) * 100 : 0,
    interactionRate:
      metrics.views > 0 ? ((metrics.likes + metrics.comments) / metrics.views) * 100 : 0,
    shareRate: metrics.views > 0 ? (metrics.shares / metrics.views) * 100 : 0,
    clickRate: metrics.views > 0 ? (metrics.clicks / metrics.views) * 100 : 0,
  };

  // Estimate impact
  let educationLevel = 5; // base
  if (engagement.engagementRate > 3) educationLevel = 7;
  if (engagement.engagementRate > 5) educationLevel = 9;
  if (metrics.watchTime > 30) educationLevel = Math.min(10, educationLevel + 1);

  let shareabilityScore = 5; // base
  if (metrics.shares / metrics.views > 0.01) shareabilityScore = 8;
  if (metrics.shares / metrics.views > 0.02) shareabilityScore = 10;

  const overallEffectiveness =
    engagement.engagementRate * 2 + // weight engagement heavily
    (metrics.watchTime > 0 ? 10 : 0) + // bonus for watch time
    (metrics.clicks > 0 ? engagement.clickRate * 5 : 0);

  const performanceMetrics: ContentPerformanceMetrics = {
    videoId,
    platform,
    metrics,
    engagement,
    audience: {
      reachScore: Math.min(100, (metrics.views / 1000) * 10), // normalize to out of 100
      impressions: metrics.views * 1.2, // estimate
      uniqueReaches: Math.floor(metrics.views * 0.85),
      conversionRate: metrics.clicks / metrics.views > 0 ? (metrics.clicks / metrics.views) * 100 : 0,
    },
    sentiment: {
      scoreAverage: engagement.engagementRate > 2 ? 1 : 0, // positive if good engagement
      topComments: [], // populated from actual comments
      contentWarnings: [],
    },
    estimatedImpact: {
      educationLevel,
      shareabilityScore,
      overallEffectiveness: Math.min(100, Math.ceil(overallEffectiveness)),
    },
  };

  // Store in database
  try {
    const { error } = await supabase.from('video_performance').insert({
      video_id: videoId,
      platform,
      metrics: metrics as any,
      engagement: engagement as any,
      estimated_impact: performanceMetrics.estimatedImpact as any,
      recorded_at: new Date().toISOString(),
    } as any);

    if (error) {
      console.error('Error storing performance metrics:', error);
    }
  } catch (error) {
    console.error('Error storing performance metrics:', error);
  }

  return performanceMetrics;
}

/**
 * Get aggregated analytics for a period
 */
export async function getAggregatedAnalytics(startDate: Date, endDate: Date): Promise<AggregatedMetrics> {
  try {
    const { data, error } = await supabase
      .from('video_performance')
      .select('*')
      .gte('recorded_at', startDate.toISOString())
      .lte('recorded_at', endDate.toISOString());

    if (error || !data) {
      throw error;
    }

    // Group by platform
    const platforms: Record<string, any> = {};
    const contentPillars: Record<string, any> = {};

    data.forEach((item: any) => {
      if (!platforms[item.platform]) {
        platforms[item.platform] = {
          videos: 0,
          totalViews: 0,
          totalEngagement: 0,
          avgEngagementRate: 0,
          topPerformer: '',
          maxViews: 0,
        };
      }

      platforms[item.platform].videos += 1;
      platforms[item.platform].totalViews += item.metrics.views || 0;
      platforms[item.platform].totalEngagement +=
        (item.engagement.engagementRate || 0) * (item.metrics.views || 1);

      if ((item.metrics.views || 0) > platforms[item.platform].maxViews) {
        platforms[item.platform].maxViews = item.metrics.views || 0;
        platforms[item.platform].topPerformer = item.video_id;
      }
    });

    // Calculate averages
    Object.keys(platforms).forEach((platform) => {
      const p = platforms[platform];
      p.avgEngagementRate =
        p.videos > 0 ? p.totalEngagement / p.videos : 0;
    });

    // Determine best posting time (mock - in real scenario, analyze by hour posted)
    const bestPostingTime = '18:00 UTC'; // Evening engagement peak
    const bestContentType = 'historical_context'; // Most engaged format
    const audienceGrowth = data.length * 1250; // estimate based on content volume
    const viralityThreshold = 5; // engagement rate >= 5% considered viral

    return {
      period: {
        startDate,
        endDate,
        days: Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)),
      },
      totalVideos: data.length,
      platforms: platforms,
      contentPillars: contentPillars,
      trends: {
        bestPostingTime,
        bestContentType,
        audienceGrowth,
        viralityThreshold,
      },
    };
  } catch (error) {
    console.error('Error getting aggregated analytics:', error);
    return {
      period: {
        startDate,
        endDate,
        days: 0,
      },
      totalVideos: 0,
      platforms: {},
      contentPillars: {},
      trends: {
        bestPostingTime: '18:00 UTC',
        bestContentType: 'unknown',
        audienceGrowth: 0,
        viralityThreshold: 5,
      },
    };
  }
}

/**
 * Determine if content should be re-promoted based on performance
 */
export function shouldRePromoteContent(performance: ContentPerformanceMetrics): {
  recommend: boolean;
  reason: string;
  suggestedTime: string;
} {
  const { engagement, metrics } = performance;

  // Re-promote if:
  // 1. High engagement but declining views
  // 2. Exceptional impact despite moderate reach
  // 3. Strong evergreen potential

  const shouldRepromote =
    engagement.engagementRate > 2 || // Good engagement rate
    metrics.shares > 50 || // Lots of shares
    performance.estimatedImpact.overallEffectiveness > 70; // High quality impact

  return {
    recommend: shouldRepromote,
    reason: shouldRepromote
      ? 'Content shows strong engagement and educational value - candidate for re-distribution'
      : 'Content performance does not warrant re-promotion at this time',
    suggestedTime: shouldRepromote ? 'In 2 weeks for different audience segment' : 'Archive',
  };
}

/**
 * Get performance breakdown by content pillar
 */
export async function getPillarPerformance(pillar: string): Promise<{
  pillar: string;
  totalContent: number;
  avgEngagement: number;
  topPerformers: string[];
  recommendation: string;
}> {
  try {
    // Query content by pillar and their performance
    const { data, error } = await supabase
      .from('content_direction')
      .select('clip_id, virality_score')
      .eq('content_pillar', pillar);

    if (error || !data || data.length === 0) {
      return {
        pillar,
        totalContent: 0,
        avgEngagement: 0,
        topPerformers: [],
        recommendation: 'Insufficient data for pillar analysis',
      };
    }

    const avgEngagement =
      data.reduce((sum, item) => sum + (item.virality_score || 0), 0) / data.length;

    const topPerformers = data
      .sort((a, b) => (b.virality_score || 0) - (a.virality_score || 0))
      .slice(0, 3)
      .map((item) => item.clip_id);

    const recommendation =
      avgEngagement > 6 ? 'Strong pillar - increase content frequency' :
      avgEngagement > 3 ? 'Moderate pillar - maintain current output' :
      'Underperforming pillar - review content strategy and storytelling approach';

    return {
      pillar,
      totalContent: data.length,
      avgEngagement,
      topPerformers,
      recommendation,
    };
  } catch (error) {
    console.error('Error getting pillar performance:', error);
    return {
      pillar,
      totalContent: 0,
      avgEngagement: 0,
      topPerformers: [],
      recommendation: 'Error retrieving data',
    };
  }
}
