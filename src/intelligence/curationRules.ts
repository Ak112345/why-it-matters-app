export const curationRules = {
  autoApprove: {
    culturalRelevanceMin: 7,
    explainabilityMin: 6,
    platformScoreMin: 7,
    hookInFirstThreeSeconds: true,
    durationSecondsMin: 5,
    durationSecondsMax: 60
  },
  autoReject: {
    noNarrative: true,
    pureAesthetic: true,
    copyrightedMusic: true,
    belowResolution: '720p',
    nearDuplicate: true
  },
  humanReview: {
    controversyScoreMin: 8,
    unclearLicensing: true,
    politicalFiguresProminent: true,
    borderlineScoreRange: [5, 6]
  }
};
