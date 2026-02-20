/**
 * Content Team Roles & Responsibilities
 * Defines what each team member does to ensure flawless content delivery
 */

export enum TeamRole {
  CONTENT_DIRECTOR = 'content_director',
  EDITOR = 'editor',
  PRODUCER = 'producer',
  PLATFORM_SPECIALIST = 'platform_specialist',
  ANALYST = 'analyst',
}

export interface TeamMember {
  id: string;
  name: string;
  role: TeamRole;
  timezone: string;
  focus: string[];
  maxDailyCapacity: number;
}

export const teamRoles = {
  [TeamRole.CONTENT_DIRECTOR]: {
    title: 'Content Director',
    description: 'Oversees entire pipeline, ensures quality standards, approves final content',
    responsibilities: [
      'Review all analyzed content and assign quality scores',
      'Make final approval/rejection decisions',
      'Monitor weekly content mix and pillar distribution',
      'Adjust curation rules based on performance data',
      'Ensure brand voice consistency across all platforms',
      'Resolve editorial conflicts and edge cases',
      'Set weekly content themes and strategy',
      'Monitor performance metrics and recommend adjustments',
    ],
    decisonAuthority: [
      'Auto-approve content (quality > 75%)',
      'Request revisions (quality 50-75%)',
      'Reject content (quality < 50%)',
      'Override approval rules for special content',
      'Adjust posting schedules based on news cycles',
    ],
    workflowStatus: 'GATES AT: Analysis complete → QA approval needed',
    maxDailyWorkload: 50,
    successMetrics: [
      'All approved content scores > 70%',
      'Time from analysis to approval < 2 hours',
      'Weekly content mix within target distribution',
      'Zero brand voice violations published',
      'Approval consistency (similar quality gets similar decisions)',
    ],
  },

  [TeamRole.EDITOR]: {
    title: 'Editorial Reviewer',
    description: 'Detailed review of content that requires human judgment, handles revisions',
    responsibilities: [
      'Review content flagged for editorial judgment',
      'Check for factual accuracy and context completeness',
      'Verify source attribution and licensing',
      'Evaluate hook and explanation quality',
      'Request specific revisions or approve content',
      'Track revision turnaround times',
      'Document editorial decisions for consistency',
      'Flag controversial or sensitive content',
    ],
    decisionAuthority: [
      'Request revisions (specific feedback)',
      'Approve content as-is',
      'Flag for director override',
      'Request fact-checking',
    ],
    workflowStatus: 'GATES AT: QA pending → Approved or revision request',
    maxDailyWorkload: 30,
    successMetrics: [
      'Revision feedback is actionable and specific',
      'Approved content has zero factual errors',
      'Revision turnaround < 4 hours',
      'Zero duplicated feedback across reviews',
      'Consistency with other editors on similar content',
    ],
  },

  [TeamRole.PRODUCER]: {
    title: 'Video Producer',
    description: 'Transforms approved content into platform-optimized final videos',
    responsibilities: [
      'Fetch approved content from queue',
      'Apply platform-specific technical specs (9:16, resolution, branding)',
      'Create subtitles and captions per brand style',
      'Add overlays, animations, and transitions',
      'Generate platform-specific thumbnails',
      'Optimize file sizes and formats',
      'Queue final videos for distribution',
      'Handle re-edits on failed uploads',
      'Track production metrics and turnaround time',
    ],
    decisionAuthority: [
      'Make technical adjustments (crop, audio levels)',
      'Request content revision if production impossible',
      'Choose subtitle style variant',
    ],
    workflowStatus: 'GATES AT: Content approved → Ready for queue/publish',
    maxDailyWorkload: 15,
    successMetrics: [
      'All videos meet platform spec requirements',
      'Production turnaround < 3 hours per video',
      'Zero upload failures due to format issues',
      'Subtitle accuracy > 95%',
      'Consistent brand aesthetics across all videos',
    ],
  },

  [TeamRole.PLATFORM_SPECIALIST]: {
    title: 'Platform Specialist',
    description: 'Expert in Instagram, Facebook, and YouTube Shorts optimization',
    responsibilities: [
      'Optimize captions and hashtags per platform audience',
      'Schedule posts for optimal posting times',
      'Monitor post performance in first 2 hours',
      'Handle platform-specific issues or failures',
      'Manage platform account settings and metadata',
      'A/B test posting strategies',
      'Document platform-specific best practices',
      'Report platform API issues and changes',
    ],
    decisionAuthority: [
      'Choose optimal posting time within 4-hour window',
      'Adjust hashtags within brand guidelines',
      'Reschedule posts due to platform issues',
      'Request content revision if platform incompatible',
    ],
    workflowStatus: 'GATES AT: Video produced → Posted on all platforms',
    maxDailyWorkload: 25,
    successMetrics: [
      'Average engagement rate > 2%',
      'Post reach > 10,000 per video',
      'Zero platform policy violations',
      'First-hour engagement > 15% of total',
      'Platform follower growth consistent week-to-week',
    ],
  },

  [TeamRole.ANALYST]: {
    title: 'Performance Analyst',
    description: 'Measures content effectiveness and provides data-driven recommendations',
    responsibilities: [
      'Track performance metrics daily',
      'Identify top-performing content and content pillars',
      'Analyze audience demographics and engagement patterns',
      'Measure educational impact and share rates',
      'Identify trends and seasonal patterns',
      'Create weekly and monthly performance reports',
      'Recommend content strategy adjustments',
      'Monitor brand sentiment in comments',
      'Test new content formats and topics',
    ],
    decisionAuthority: [
      'Recommend content for re-promotion',
      'Suggest pillar adjustments to director',
      'Recommend optimal posting time changes',
      'Flag underperforming content types',
    ],
    workflowStatus: 'GATES AT: Content posted → Performance review weekly',
    maxDailyWorkload: 20,
    successMetrics: [
      'Weekly reports delivered by Monday',
      'Actionable insights provided each report',
      'Trends caught early (within 2 posts)',
      'Recommendations > 80% accuracy over time',
      'Data presented clearly to non-technical team',
    ],
  },
};

export const approvalWorkflow = {
  stages: [
    {
      stage: 'ANALYSIS_COMPLETE',
      actor: 'Automation + OpenAI',
      output: 'Hook, explanation, captions, hashtags, virality score',
      duration: '< 5 minutes',
    },
    {
      stage: 'QUALITY_CHECK',
      actor: 'Automated QA',
      output: 'Quality score (0-100), critiques, recommendations',
      duration: '< 1 minute',
    },
    {
      stage: 'DIRECTOR_GATE',
      actor: 'Content Director',
      output: 'Approve (auto), Request revision, or Reject',
      duration: '< 2 hours',
      decision_rules: [
        'Score > 75: Auto-approve',
        '60-75: Flag for editorial review',
        '< 60: Reject with revision notes',
      ],
    },
    {
      stage: 'EDITORIAL_REVIEW',
      actor: 'Editor (if flagged)',
      output: 'Approve as-is or Request specific revisions',
      duration: '< 4 hours',
    },
    {
      stage: 'REVISION_LOOP',
      actor: 'Content creator re-analyzes',
      output: 'Updated content for re-review',
      maxAttempts: 2,
      duration: '< 6 hours per round',
    },
    {
      stage: 'FINAL_APPROVAL',
      actor: 'Director or Editor',
      output: 'Approved → Send to production',
      duration: '< 30 minutes',
    },
    {
      stage: 'VIDEO_PRODUCTION',
      actor: 'Video Producer',
      output: 'Final video file, platform-optimized',
      duration: '< 3 hours',
    },
    {
      stage: 'PLATFORM_POSTING',
      actor: 'Platform Specialist',
      output: 'Posted to 3 platforms with optimal timing',
      duration: '< 1 hour',
    },
    {
      stage: 'PERFORMANCE_TRACKING',
      actor: 'Analyst + Automation',
      output: 'Daily and weekly performance reports',
      duration: 'Ongoing (24-365 days)',
    },
  ],
  totalTimeToPost: '< 12 hours (analysis to posted)',
  metrics: {
    qualityThreshold: 70,
    approvalConsistency: 95,
    revisionRate: '< 20%',
    productionSpeed: '< 3 hours',
    platformReach: '> 50,000 impressions/week',
  },
};

export const contentGovernance = {
  brandVoice: 'Measurable across tone, perspective, and content alignment',
  editsAllowed: [
    'Hook rewriting (must stay true to content)',
    'Caption improvements (grammar, clarity)',
    'Hashtag optimization (platform-specific)',
    'Subtitle timing adjustments',
  ],
  editsNotAllowed: [
    'Changing source material',
    'Omitting important context',
    'Altering factual statements',
    'Removing attribution',
    'Adding sensationalism',
  ],
  escalationPath:
    'Issue → Editor → Director → Management for policy questions',
  conflictResolution: 'Guidelines supersede preference. Data trumps opinion.',
};
