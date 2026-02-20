/**
 * Content Quality Assurance
 * Validates all content meets editorial standards before posting
 */

// Supabase import reserved for future direct database operations
import { qualityStandards, brandVoice } from './editorialGuidelines';

export interface ContentValidation {
  isValid: boolean;
  score: number; // 0-100
  critiques: string[];
  warnings: string[];
  recommendations: string[];
  metadata: {
    hookStrength: number;
    clarityScore: number;
    relevanceScore: number;
    sensationalismScore: number;
    attributionComplete: boolean;
    contextualInformationPresent: boolean;
  };
}

/**
 * Score the quality of a caption/hook
 * Checks for clarity, engagement, and alignment with brand voice
 */
export function evaluateCaptionQuality(
  caption: string,
  hook: string
): { hookStrength: number; captionClarity: number } {
  let hookStrength = 5; // base score

  // Check hook metrics
  const hookLength = hook.split(' ').length;
  if (hookLength >= 5 && hookLength <= 15) hookStrength += 2; // optimal length
  if (hook.includes('?') || hook.includes('discover') || hook.includes('reveal')) hookStrength += 1;
  if (!/^[A-Z]/.test(hook)) hookStrength -= 1; // should start with capital

  let captionClarity = 5; // base score
  const captionLength = caption.split(' ').length;
  if (captionLength >= 30 && captionLength <= 200) captionClarity += 2;
  if ((caption.match(/\./g) || []).length >= 2) captionClarity += 1; // good sentence structure
  if ((caption.match(/[#@]/g) || []).length <= 10) captionClarity += 1; // not hashtag-heavy

  return {
    hookStrength: Math.min(10, hookStrength),
    captionClarity: Math.min(10, captionClarity),
  };
}

/**
 * Evaluate source attribution and licensing
 */
export function validateSourceAttribution(metadata: Record<string, any>): {
  isComplete: boolean;
  missingFields: string[];
} {
  const requiredFields = ['source', 'sourceUrl', 'creator', 'license'];
  const missingFields = requiredFields.filter((field) => !metadata[field]);

  return {
    isComplete: missingFields.length === 0,
    missingFields,
  };
}

/**
 * Check for sensationalism indicators
 * Returns score 0-10 where 0 = properly measured, 10 = highly sensational
 */
export function detectSensationalism(caption: string, explanation: string): number {
  let score = 0;

  const sensationalWords = [
    'shocking',
    'outrageous',
    'disgusting',
    'unbelievable',
    'jaw-dropping',
    'explosive',
    'destroyed',
    'slammed',
  ];

  const text = (caption + ' ' + explanation).toLowerCase();
  const sensationalCount = sensationalWords.filter((word) => text.includes(word)).length;
  score += sensationalCount * 2;

  // Check for ALL CAPS abuse (more than 10% of text)
  const capsRatio = (text.match(/[A-Z]/g) || []).length / text.length;
  if (capsRatio > 0.1) score += 2;

  // Check for excessive exclamation marks
  const exclamationCount = (text.match(/!/g) || []).length;
  if (exclamationCount > 3) score += 1;

  return Math.min(10, score);
}

/**
 * Validate content alignment with brand voice
 */
export function validateBrandAlignment(caption: string, explanation: string): {
  aligned: boolean;
  issues: string[];
  brandFitScore: number; // 0-10
} {
  const issues: string[] = [];
  let brandFitScore = 5; // neutral base

  const fullText = (caption + ' ' + explanation).toLowerCase();

  // Check against "do not" list
  brandVoice.doNot.forEach((violation) => {
    const pattern = violation.toLowerCase();
    if (fullText.includes(pattern)) {
      issues.push(`Avoids guideline: ${violation}`);
      brandFitScore -= 1.5;
    }
  });

  // Check tone alignment
  const toneIndicators = {
    informative: ['explains', 'reveals', 'shows', 'demonstrates', 'explores'],
    compelling: ['think', 'imagine', 'consider', 'important', 'matters'],
    accessible: ['obvious', 'clear', 'direct', 'plain language'],
    neutral: ['perspective', 'both', 'consider', 'however', 'also'],
  };

  let toneMatches = 0;
  Object.entries(toneIndicators).forEach(([_tone, indicators]) => {
    if (indicators.some((ind) => fullText.includes(ind))) {
      toneMatches++;
      brandFitScore += 0.5;
    }
  });

  return {
    aligned: issues.length === 0 && toneMatches >= 2,
    issues,
    brandFitScore: Math.min(10, Math.max(0, brandFitScore)),
  };
}

/**
 * Comprehensive content validation
 * Returns detailed assessment and pass/fail decision
 */
export async function validateContent(
  analysisData: {
    hook: string;
    explanation: string;
    caption: string;
    hashtags: string[];
    viralityScore: number;
    metadata: Record<string, any>;
  },
  releaseContext?: {
    contentPillar?: string;
    sourceId?: string;
    isTimelyContent?: boolean;
  }
): Promise<ContentValidation> {
  const critiques: string[] = [];
  const warnings: string[] = [];
  const recommendations: string[] = [];
  let validationScore = 50; // start at 50/100

  // 1. Caption Quality Check
  const { hookStrength, captionClarity } = evaluateCaptionQuality(
    analysisData.caption,
    analysisData.hook
  );

  if (hookStrength < qualityStandards.minHookStrength) {
    critiques.push(
      `Hook strength too low (${hookStrength}/10). Needs more compelling language.`
    );
    validationScore -= 10;
  } else {
    validationScore += 5;
  }

  if (captionClarity < qualityStandards.minExplanationClarity) {
    critiques.push(
      `Caption clarity insufficient (${captionClarity}/10). Needs clearer explanation.`
    );
    validationScore -= 10;
  } else {
    validationScore += 5;
  }

  // 2. Virality & Relevance Check
  const culturalRelevanceScore = analysisData.metadata?.platform_scores?.instagram || 5;
  if (culturalRelevanceScore < qualityStandards.minCulturalRelevanceScore) {
    warnings.push(
      `Low cultural relevance score (${culturalRelevanceScore}/10). May have limited appeal.`
    );
    validationScore -= 5;
  } else {
    validationScore += 5;
  }

  // 3. Sensationalism Check
  const sensationalismScore = detectSensationalism(analysisData.caption, analysisData.explanation);
  if (sensationalismScore > qualityStandards.maxSensationalismScore) {
    critiques.push(
      `Sensationalism score too high (${sensationalismScore}/10). Tone must be measured.`
    );
    validationScore -= 10;
  } else {
    validationScore += 5;
  }

  // 4. Brand Alignment Check
  const brandAlignment = validateBrandAlignment(analysisData.caption, analysisData.explanation);
  if (!brandAlignment.aligned) {
    critiques.push('Brand voice misalignment: ' + brandAlignment.issues.join(', '));
    validationScore -= 10;
  } else {
    validationScore += brandAlignment.brandFitScore;
  }

  // 5. Attribution Check
  if (qualityStandards.requireSourceAttribution) {
    const attribution = validateSourceAttribution(analysisData.metadata);
    if (!attribution.isComplete) {
      critiques.push(
        `Missing source attribution: ${attribution.missingFields.join(', ')}`
      );
      validationScore -= 10;
    } else {
      validationScore += 5;
    }
  }

  // 6. Context & Explanation Check
  if (qualityStandards.requireContextualInformation) {
    if (!analysisData.explanation || analysisData.explanation.split(' ').length < 20) {
      warnings.push('Explanation may lack sufficient context. Consider expanding.');
      validationScore -= 5;
    }
  }

  // 7. Content Pillar Diversity (if available)
  if (releaseContext?.contentPillar) {
    recommendations.push(`Categorized as: ${releaseContext.contentPillar}`);
  }

  // Add recommendations for improvement
  if (validationScore < 70) {
    if (hookStrength < 7) {
      recommendations.push(
        'Strengthen hook: Use more compelling language or create curiosity gap'
      );
    }
    if (sensationalismScore > 3) {
      recommendations.push(
        'Reduce sensationalism: Use measured language while maintaining engagement'
      );
    }
    if (!brandAlignment.aligned) {
      recommendations.push('Align with brand voice: Review editorial guidelines for tone');
    }
  }

  const finalScore = Math.max(0, Math.min(100, validationScore));

  return {
    isValid: finalScore >= 70,
    score: finalScore,
    critiques,
    warnings,
    recommendations,
    metadata: {
      hookStrength,
      clarityScore: captionClarity,
      relevanceScore: culturalRelevanceScore,
      sensationalismScore,
      attributionComplete: !qualityStandards.requireSourceAttribution ||
        validateSourceAttribution(analysisData.metadata).isComplete,
      contextualInformationPresent: !qualityStandards.requireContextualInformation ||
        (analysisData.explanation?.split(' ').length || 0) >= 20,
    },
  };
}

/**
 * Batch validate multiple content pieces
 */
export async function validateContentBatch(
  contentList: Parameters<typeof validateContent>[0][]
): Promise<ContentValidation[]> {
  return Promise.all(contentList.map((content) => validateContent(content)));
}
