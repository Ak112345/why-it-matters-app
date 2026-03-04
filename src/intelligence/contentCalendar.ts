cat > /workspaces/why-it-matters-app/src/intelligence/contentCalendar.ts << 'EOF'
export type ContentPillar =
  | 'Policy Change'
  | 'Cultural Event'
  | 'Internet Controversy'
  | 'News Moment'
  | 'Public Reaction'
  | 'Social Discussion'
  | 'Social Shift';

export interface DayConfig {
  pillar: ContentPillar;
  priority: 'instagram' | 'youtube' | 'all';
  searchQueries: string[];
}

export const contentCalendar: Record<string, DayConfig> = {
  monday: {
    pillar: 'Policy Change',
    priority: 'all',
    searchQueries: [
      'government building congress',
      'politician speaking podium',
      'parliament debate voting',
      'press conference microphone',
      'supreme court building',
      'protest sign march street',
      'white house washington dc',
      'senate hearing testimony',
    ],
  },
  tuesday: {
    pillar: 'Cultural Event',
    priority: 'all',
    searchQueries: [
      'concert crowd festival music',
      'award ceremony red carpet',
      'sports stadium crowd cheering',
      'parade street celebration',
      'cultural festival dancing',
      'art gallery exhibition opening',
      'film premiere crowd',
      'graduation ceremony celebration',
    ],
  },
  wednesday: {
    pillar: 'Internet Controversy',
    priority: 'all',
    searchQueries: [
      'social media phone screen scrolling',
      'person typing laptop reaction',
      'viral video phone recording',
      'crowd filming phones event',
      'news broadcast television screen',
      'online debate discussion group',
      'influencer camera content creation',
    ],
  },
  thursday: {
    pillar: 'News Moment',
    priority: 'all',
    searchQueries: [
      'breaking news broadcast studio',
      'journalist reporter microphone field',
      'newspaper headline printing press',
      'news anchor desk television',
      'press briefing reporters cameras',
      'emergency services response scene',
      'interview politician reporter',
      'live news coverage camera crew',
    ],
  },
  friday: {
    pillar: 'Public Reaction',
    priority: 'all',
    searchQueries: [
      'crowd protest demonstration street',
      'people cheering celebration outdoor',
      'audience reaction shock surprise',
      'rally crowd political signs',
      'community gathering town hall',
      'public vigil candles memorial',
      'strike workers picketing',
    ],
  },
  saturday: {
    pillar: 'Social Discussion',
    priority: 'all',
    searchQueries: [
      'people talking debate discussion',
      'panel discussion roundtable',
      'community meeting group conversation',
      'interview talking head close up',
      'podcast microphone recording studio',
      'university lecture classroom',
      'town hall meeting audience questions',
    ],
  },
  sunday: {
    pillar: 'Social Shift',
    priority: 'all',
    searchQueries: [
      'technology innovation future city',
      'electric car charging station',
      'solar panels renewable energy',
      'diverse crowd city street',
      'young people smartphone generation',
      'urban development construction skyline',
      'remote work home office laptop',
    ],
  },
};

export function getTodaysSearchQuery(): string {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const today = days[new Date().getDay()];
  const config = contentCalendar[today];
  const queries = config.searchQueries;
  return queries[Math.floor(Math.random() * queries.length)];
}

export function getTodaysPillar(): ContentPillar {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const today = days[new Date().getDay()];
  return contentCalendar[today].pillar;
}

export function getTodaysPlatform(): 'instagram' | 'youtube_shorts' | 'all' {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const today = days[new Date().getDay()];
  const priority = contentCalendar[today].priority;
  if (priority === 'youtube') return 'youtube_shorts';
  if (priority === 'instagram') return 'instagram';
  return 'all';
}
EOF