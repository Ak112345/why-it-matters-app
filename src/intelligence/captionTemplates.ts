export const captionTemplates = {
  instagram: (hook: string, explanation: string, impact: string, hashtags: string[]) =>
    `${hook}\n\n${explanation}\n\n${impact}\n\nSave this.\n\n${hashtags.map(h => `#${h}`).join(' ')}`,
  facebook: (hook: string, explanation: string, impact: string, hashtags: string[]) =>
    `${hook}\n\n${explanation}\n\n${impact}\n\nShare if more people need to know this.\n\n${hashtags.slice(0, 5).map(h => `#${h}`).join(' ')}`,
  youtubeTitle: (topic: string) => `${topic} - This Is Why It Matters`,
  youtubeDescription: (summary: string, topic: string) =>
    `${summary}\n\nWhat do you think? Drop a comment below.\n\n#Shorts #${topic.replace(/\s+/g, '')} #ThisIsWhyItMatters #History #News`
};
