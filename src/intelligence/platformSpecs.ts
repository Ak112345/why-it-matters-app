export const platformSpecs = {
  instagram: {
    aspectRatio: '9:16',
    resolution: '1080x1920',
    maxDurationSeconds: 90,
    captionBurnIn: true,
    safeZone: { topPx: 150, bottomPx: 300 },
    watermarkPosition: 'bottom-center'
  },
  facebook: {
    aspectRatio: '9:16',
    resolution: '1080x1920',
    maxDurationSeconds: 60,
    captionBurnIn: true,
    safeZone: { topPx: 150, bottomPx: 250 },
    watermarkPosition: 'bottom-center'
  },
  youtube: {
    aspectRatio: '9:16',
    resolution: '1080x1920',
    maxDurationSeconds: 60,
    captionBurnIn: true,
    safeZone: { topPx: 200, bottomPx: 300 },
    watermarkPosition: 'bottom-left'
  }
};

export const subtitleStyle = {
  fontFamily: 'Montserrat Bold',
  fontSizePx: 76,
  color: 'white',
  outlineColor: 'black',
  maxWordsPerLine: 6,
  highlightColor: 'accent'
};
