export const videoClipCriteria = {
  contentTypes: [
    'crowd_reactions',
    'public_gatherings',
    'press_conferences',
    'protest_footage',
    'street_level_moments',
    'historical_newsreel',
    'government_proceedings',
    'cultural_milestones'
  ],
  technical: {
    minResolution: '720p',
    preferredResolution: '1080p',
    minDurationSeconds: 5,
    maxDurationSeconds: 90,
    allowedAspectRatios: ['16:9', '9:16'],
    allowWatermarks: false,
    allowCopyrightedMusic: false
  },
  scoringDimensions: [
    'cultural_relevance',
    'emotional_weight',
    'explainability',
    'controversy_potential',
    'evergreen_or_trending'
  ]
};

export const newspaperClippingCriteria = {
  eras: [
    { label: '1900-1970', purpose: 'historical_context' },
    { label: '1970-2000', purpose: 'policy_social_shift' }
  ],
  contentTypes: [
    'front_page_headlines',
    'editorial_cartoons',
    'protest_movement_coverage',
    'economic_turning_points',
    'court_decisions_legal_milestones'
  ],
  visualQuality: {
    minWidthPx: 800,
    highContrastPreferred: true,
    minimizeArtifacts: true
  }
};
