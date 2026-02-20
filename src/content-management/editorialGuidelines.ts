/**
 * Editorial Guidelines & Brand Direction
 * Establishes voice, tone, content pillars, and quality standards
 */

export interface BrandVoice {
  tone: string[];
  perspective: string;
  audienceTarget: string;
  coreValues: string[];
  doNot: string[];
}

export const brandVoice: BrandVoice = {
  tone: ['informative', 'compelling', 'accessible', 'neutral-but-engaged', 'urgent-when-warranted'],
  perspective: 'Shed light on untold stories and overlooked perspectives that shape our world',
  audienceTarget: 'Intellectually curious global audience aged 18-65 seeking deeper understanding',
  coreValues: ['Truth', 'Relevance', 'Impact', 'Clarity', 'Accountability'],
  doNot: [
    'Sensationalize without substance',
    'Spread misinformation or unverified claims',
    'Exploit human suffering for engagement',
    'Use clickbait that misleads',
    'Ignore context or nuance',
  ],
};

export enum ContentPillar {
  HISTORICAL_CONTEXT = 'historical_context',
  POLICY_IMPACT = 'policy_impact',
  SOCIAL_MOVEMENTS = 'social_movements',
  ECONOMY_FINANCE = 'economy_finance',
  SCIENCE_INNOVATION = 'science_innovation',
  ENVIRONMENT_CLIMATE = 'environment_climate',
  JUSTICE_RIGHTS = 'justice_rights',
  CULTURE_IDENTITY = 'culture_identity',
}

export const pillarGuidance = {
  [ContentPillar.HISTORICAL_CONTEXT]: {
    description: 'Archival footage and historical documents showing how past events shaped present',
    focusAreas: ['primary sources', 'newsreels', 'declassified materials', 'eyewitness accounts'],
    goalStoryType: 'Show cause-and-effect between historical events and current reality',
  },
  [ContentPillar.POLICY_IMPACT]: {
    description: 'Real-world effects of policy decisions on communities',
    focusAreas: ['legislative impact', 'regulatory changes', 'government programs', 'budget allocations'],
    goalStoryType: 'Illustrate how policy affects daily life with concrete examples',
  },
  [ContentPillar.SOCIAL_MOVEMENTS]: {
    description: 'Organized efforts for social change and their outcomes',
    focusAreas: ['protests', 'civil rights', 'activism', 'grassroots campaigns'],
    goalStoryType: 'Capture momentum, strategy, and impact of movements',
  },
  [ContentPillar.ECONOMY_FINANCE]: {
    description: 'Economic trends, market forces, and financial systems affecting people',
    focusAreas: ['inequality', 'labor', 'wealth gaps', 'economic transitions'],
    goalStoryType: 'Make complex economics understandable with human impact',
  },
  [ContentPillar.SCIENCE_INNOVATION]: {
    description: 'Breakthroughs and discoveries changing how we live',
    focusAreas: ['medical advances', 'technology', 'research', 'public health'],
    goalStoryType: 'Explain "why it matters" for ordinary people',
  },
  [ContentPillar.ENVIRONMENT_CLIMATE]: {
    description: 'Environmental changes and humanity\'s response',
    focusAreas: ['climate impacts', 'conservation', 'pollution', 'sustainability'],
    goalStoryType: 'Show both problems and solutions with local-to-global scale',
  },
  [ContentPillar.JUSTICE_RIGHTS]: {
    description: 'Justice systems, legal battles, and human rights issues',
    focusAreas: ['court proceedings', 'human rights', 'legal change', 'accountability'],
    goalStoryType: 'Illuminate struggles and victories in pursuit of justice',
  },
  [ContentPillar.CULTURE_IDENTITY]: {
    description: 'Cultural phenomena, identity, and community narratives',
    focusAreas: ['traditions', 'art', 'language', 'community', 'identity expression'],
    goalStoryType: 'Celebrate and explain diverse perspectives and traditions',
  },
};

export interface ContentQualityStandards {
  minHookStrength: number; // 1-10 scale
  minExplanationClarity: number;
  minCulturalRelevanceScore: number;
  requireSourceAttribution: boolean;
  requireContextualInformation: boolean;
  maxSensationalismScore: number; // 0-10, lower is better
  minDiversityScore: number; // Avoid homogeneous content
}

export const qualityStandards: ContentQualityStandards = {
  minHookStrength: 7,
  minExplanationClarity: 7,
  minCulturalRelevanceScore: 6,
  requireSourceAttribution: true,
  requireContextualInformation: true,
  maxSensationalismScore: 4,
  minDiversityScore: 5,
};

export interface PostingStrategy {
  optimalPostingTimes: {
    weekday: string;
    timeUTC: string;
    rationale: string;
  }[];
  maxDailyPosts: number;
  minHoursBetweenPosts: number;
  contentMixRatio: {
    [key in ContentPillar]?: number;
  };
  quietHourRanges: {
    startUTC: string;
    endUTC: string;
    reason: string;
  }[];
}

export const postingStrategy: PostingStrategy = {
  optimalPostingTimes: [
    { weekday: 'Monday', timeUTC: '15:00', rationale: 'Start of work week engagement' },
    { weekday: 'Tuesday', timeUTC: '10:00', rationale: 'Mid-morning focus' },
    { weekday: 'Wednesday', timeUTC: '18:00', rationale: 'Evening browsing peak' },
    { weekday: 'Thursday', timeUTC: '14:00', rationale: 'Afternoon engagement' },
    { weekday: 'Friday', timeUTC: '17:00', rationale: 'Weekend preview' },
    { weekday: 'Saturday', timeUTC: '12:00', rationale: 'Weekend leisure time' },
    { weekday: 'Sunday', timeUTC: '19:00', rationale: 'Evening planning/catch-up' },
  ],
  maxDailyPosts: 3,
  minHoursBetweenPosts: 4,
  contentMixRatio: {
    [ContentPillar.HISTORICAL_CONTEXT]: 0.2,
    [ContentPillar.POLICY_IMPACT]: 0.15,
    [ContentPillar.SOCIAL_MOVEMENTS]: 0.15,
    [ContentPillar.ECONOMY_FINANCE]: 0.15,
    [ContentPillar.SCIENCE_INNOVATION]: 0.15,
    [ContentPillar.ENVIRONMENT_CLIMATE]: 0.1,
    [ContentPillar.JUSTICE_RIGHTS]: 0.1,
    [ContentPillar.CULTURE_IDENTITY]: 0.0,
  },
  quietHourRanges: [
    { startUTC: '02:00', endUTC: '06:00', reason: 'Late night/early morning (low engagement)' },
    { startUTC: '23:00', endUTC: '02:00', reason: 'Post-midnight (sleep hours)' },
  ],
};

export interface EditorialCalendar {
  theme: string;
  week: number;
  focusPillars: ContentPillar[];
  storyArcs: string[];
  numberOfPosts: number;
  description: string;
}

export const editorialCalendar: EditorialCalendar[] = [
  {
    theme: 'Democracy & Participation',
    week: 1,
    focusPillars: [ContentPillar.POLICY_IMPACT, ContentPillar.JUSTICE_RIGHTS],
    storyArcs: ['Voting rights evolution', 'Civic engagement impact'],
    numberOfPosts: 3,
    description: 'How democratic systems are shaped and evolve through citizen action',
  },
  {
    theme: 'Innovation & Progress',
    week: 2,
    focusPillars: [ContentPillar.SCIENCE_INNOVATION, ContentPillar.ECONOMY_FINANCE],
    storyArcs: ['Technology disruption', 'Job market evolution'],
    numberOfPosts: 3,
    description: 'Breakthroughs that change human capabilities and economic landscapes',
  },
  {
    theme: 'Social Movements & Change',
    week: 3,
    focusPillars: [ContentPillar.SOCIAL_MOVEMENTS, ContentPillar.JUSTICE_RIGHTS],
    storyArcs: ['Organized change agents', 'Rights victories'],
    numberOfPosts: 3,
    description: 'How collective action achieves systemic change',
  },
  {
    theme: 'Climate & Environment',
    week: 4,
    focusPillars: [ContentPillar.ENVIRONMENT_CLIMATE, ContentPillar.SCIENCE_INNOVATION],
    storyArcs: ['Climate impacts', 'Green solutions'],
    numberOfPosts: 2,
    description: 'Environmental challenges and humanity\'s innovative responses',
  },
];
