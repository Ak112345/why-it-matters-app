# Content Management System - Implementation Guide

## Overview

This system implements a complete editorial workflow that ensures every piece of content is:
- **Accurate**: Vetted for facts, context, and proper attribution
- **On-Brand**: Aligned with editorial voice, tone, and content pillars
- **Effective**: Measured for educational impact and audience engagement
- **Optimized**: Tailored to each platform's unique audience and technical specs

---

## The Pipeline: Content Journey to Posted

### 1. **Ingestion** → Raw Clips Stored
- **Input**: Video clips from Pexels, Pixabay
- **Your Role**: Approve which sources to pull from
- **Output**: Clips stored in `clips_raw` table with metadata
- **API**: `POST /api/ingest`

### 2. **Segmentation** → Long Videos Split
- **Input**: Raw clips (potentially long)
- **Your Role**: Configure segment duration (default 10s)
- **Output**: Bite-sized segments in `clips_segmented`
- **API**: `POST /api/segment`

### 3. **Analysis** → OpenAI Creates Copy
- **Input**: Segments with transcript/visual context
- **Your Role**: Review analysis quality scores
- **Output**: Hook, explanation, captions, hashtags, virality score
- **API**: `POST /api/analyze`
- **Quality Gate**: **DIRECTOR APPROVAL REQUIRED HERE**

### 4. **Director Approval** → QA & Routing
- **Input**: Analyzed clip with quality score
- **Automated Routes**:
  - `Score > 75%`: ✅ Auto-approve → move to production
  - `Score 60-75%`: 🔍 Flag for editorial review
  - `Score < 60%`: ❌ Reject with revision suggestions
- **Your Role**: Review flagged items, make final decisions
- **API**: `POST /api/content/approve`

### 5. **Editorial Review** (If Needed)
- **Input**: Medium-quality content requiring human judgment
- **Your Role**: Check facts, context, tone, attribution
- **Options**:
  - ✅ Approve as-is
  - ✏️ Request specific revisions
  - 🔄 Loop back to analysis team (max 2 attempts)
- **API**: `POST /api/content/review`

### 6. **Production** → Video Created
- **Input**: Approved copy + content specifications
- **Format**: 9:16 vertical, 1080x1920px, platform-optimized
- **Additions**: Subtitles, overlays, branding
- **Your Role**: Monitor production queue, handle failures
- **API**: `POST /api/produce`

### 7. **Posting** → Distribution Queue
- **Input**: Final video file
- **Routing**: Instagram, Facebook, YouTube Shorts (9 posts/platform/week)
- **Scheduling**: Smart timing based on analytics
- **Your Role**: Confirm posts scheduled correctly
- **API**: `POST /api/queue`

### 8. **Publishing** → Live on Platforms
- **Input**: Queued videos with platform settings
- **Monitoring**: Track first 2 hours of engagement
- **Handling**: Retry failed uploads automatically
- **API**: `POST /api/publish`

### 9. **Performance Tracking** → Weekly Insights
- **Input**: Engagement metrics from platforms
- **Measures**: Views, likes, comments, shares, watch time
- **Analysis**: Identify top content, audience trends, re-promotion candidates
- **Your Role**: Review insights, adjust strategy
- **API**: `GET /api/content/performance`

---

## Your Daily Responsibilities as Content Director

### Morning (30 minutes)
1. **Check Director's Brief** (`/api/content/director-brief`)
   - How many pieces pending QA?
   - Any critical quality issues?
   - Are we on track for weekly quota?

2. **Review Overnight Analysis**
   - Any high-quality content ready to auto-approve?
   - Anything that needs your attention?

3. **Check yesterday's posting**
   - Did all videos post successfully?
   - Any platform errors?

### Throughout the Day (as content arrives)
1. **Review flagged content** (60-75% quality)
   - Is it accurate?
   - Does the tone match our brand?
   - Is context sufficient?
   - **Decision**: Approve, request revisions, or reject

2. **Handle revisions**
   - If revision requested: provide specific feedback
   - If reanalyzed: review new version
   - **Decision**: Approve or request round 2 (max 2 attempts)

3. **Monitor production queue**
   - Check for bottlenecks
   - Handle any production issues
   - Confirm final videos meet spec

### Weekly (Friday morning)
1. **Review Performance Analytics** (`/api/content/performance?action=aggregated&days=7`)
   - What content performed best?
   - Which content pillars resonated?
   - What's our engagement trend?

2. **Plan Next Week's Content Mix**
   - Check editorial calendar theme
   - Ensure pillar distribution on track
   - Adjust if needed based on performance

3. **Approval Metrics Check**
   - How many did we approve vs. reject?
   - Average approval time?
   - Any patterns in what fails?

---

## Quality Standards: What Makes Content "Approval Worthy"

### Automated QA (0-100 score)

| Component | Minimum | What We Check |
|-----------|---------|---------------|
| **Hook Strength** | 7/10 | Does it create curiosity? Emotional pull? First 3-5 words matter. |
| **Explanation Clarity** | 7/10 | Can a reader understand context without prior knowledge? |
| **Cultural Relevance** | 6/10 | Does it address something audiences care about? |
| **Tone Alignment** | Must pass | Informative? Compelling? Accessible? Measured (not sensational)? |
| **Attribution** | 100% complete | Source, creator, license, URL all listed? |
| **Sensationalism** | < 4/10 | No clickbait. No exaggeration. Measured language. |

### Your Manual Review (for 60-75% content)

**Ask These Questions:**

1. **Is it factually accurate?**
   - Check: Dates, names, numbers, quotes against reliable sources
   - If unsure: Flag for fact-checking before approval

2. **Is context sufficient?**
   - Does reader understand the "why it matters" part?
   - Are we explaining complexity clearly or oversimplifying?

3. **Is attribution clear?**
   - Can someone find the original source from the caption?
   - Are we properly crediting creators (critical for Pixabay)?

4. **Does tone match brand?**
   - Avoid: Sensationalism, clickbait, misleading emphasis
   - Aim for: Measured, curious, compelling, accountable

5. **Is this the right content pillar?**
   - Historical context? Policy impact? Social movement? Science? Climate?
   - Is the AI's categorization correct?

---

## Decision Flowchart

```
Content Analyzed
    ↓
[AUTOMATED QA: 0-100 score]
    ↓
Is score ≥ 75%?
    ├─ YES → ✅ AUTO-APPROVE (to production)
    └─ NO → Continue
         ↓
Is score ≥ 60%?
    ├─ YES → 🔍 FLAG FOR YOUR REVIEW
    │         ↓
    │    [DIRECTOR REVIEWS]
    │         ↓
    │    Approve? ─────→ ✅ APPROVE (to production)
    │    Revise? ─────→ ✏️ REQUEST REVISIONS (back to analysis)
    │    Reject? ─────→ ❌ REJECT (archive)
    │
    └─ NO → [DIRECTOR MAKES FINAL CALL]
            ├─ Has merit? → ✏️ REQUEST REVISIONS
            └─ No way → ❌ REJECT

[HIGH PRIORITY CONTENT: Always review personally regardless of score]
    ├─ Breaking news or timely content
    ├─ Sensitive/controversial topics
    ├─ New content pillar or style
```

---

## The Approval Workflow API

### 1. Auto-Approve Content
```typescript
POST /api/content/approve
{
  "action": "approve-content",
  "clipId": "clip_123",
  "analysisData": {
    "hook": "Here's why this matters...",
    "explanation": "...", 
    "caption": "...",
    "hashtags": [...],
    "viralityScore": 8,
    "metadata": { ... }
  }
}
```

**Response**: Tells you status (approved/pending/rejected), quality score, and next steps

### 2. Request Revisions
```typescript
POST /api/content/review
{
  "action": "request-revisions",
  "clipId": "clip_123",
  "revisions": [
    "Hook feels weak - needs more curiosity",
    "Add context: What does this policy actually do?",
    "Verify claim about 1987 ruling - add source"
  ],
  "priority": "high"
}
```

### 3. Submit Editorial Decision
```typescript
POST /api/content/review
{
  "action": "submit-review",
  "taskId": "review_123",
  "editorId": "your_id",
  "approved": true,
  "feedback": "Strong content. Hook is compelling, context clear, tone perfect."
}
```

### 4. Get Director's Brief (Your Dashboard)
```typescript
GET /api/content?action=director-brief
```

**Returns**:
- Pending QA count
- Critical issues count
- Ready for production count
- Content pillar distribution
- Weekly quota status

---

## Content Pillars: Weekly Distribution Targets

Your job is to maintain balance across these categories:

| Pillar | % of content | Example Topics |
|--------|-------------|-----------------|
| Historical Context | 20% | Archival footage showing past-present connections |
| Policy Impact | 15% | Real-world effects of legislative/regulatory changes |
| Social Movements | 15% | Organized change agents and rights victories |
| Economy & Finance | 15% | Economic trends affecting daily life |
| Science & Innovation | 15% | Breakthroughs changing human capability |
| Environment & Climate | 10% | Climate challenges and human solutions |
| Justice & Rights | 10% | Justice systems and human rights progress |

**Your Task**: Monitor `GET /api/content/performance?action=by-pillar` to see which pillars are underperforming or overrepresented, then adjust intake.

---

## Handling Failures & Bottlenecks

### Content Analyzed But Low Quality (< 60%)
- **Root Cause**: Usually weak source material or analysis prompt mismatch
- **Your Action**: 
  1. Reject with specific feedback
  2. Flag if pattern emerges (e.g., "All Pixabay music videos score low")
  3. Adjust sourcing or analysis prompts accordingly

### Content Flagged But No One Reviews It (building queue)
- **Root Cause**: Insufficient editorial capacity
- **Your Action**:
  1. Prioritize by virality score (high score = review first)
  2. Batch reviews to be more efficient
  3. Escalate need for more editors if queue > 20 items

### Approved Content Can't Be Produced (< 5% happens)
- **Root Cause**: Usually format incompatibility or licensing issue
- **Your Action**:
  1. Investigate specific error
  2. Either fix production specs or request revision
  3. Update production guidelines to prevent future issues

### Video Posted But Failed (platform error)
- **Root Cause**: Platform API issue or credential problem, not content quality
- **Your Action**:
  1. Verify credentials with platform specialist
  2. Retry immediately
  3. If persists: escalate to platform team or manually post

---

## Weekly Content Strategy

### Editorial Calendar (Rotates Monthly)

Week 1: **Democracy & Participation**
- Focus: Policy impact + Social movements
- Target: 3 posts combining voting rights, civic engagement

Week 2: **Innovation & Progress**
- Focus: Science + Economy
- Target: 3 posts on technology disruption, job market

Week 3: **Social Movements & Change**
- Focus: Social movements + Justice
- Target: 3 posts on organized change, rights victories

Week 4: **Climate & Environment**
- Focus: Environment + Science
- Target: 2-3 posts on climate impacts, green solutions

**Your Role**: Ensure content coming through matches the theme, adjust intake if needed.

---

## Performance Targets (What Success Looks Like)

### For You (Director)
- ✅ All approved content > 70% quality score
- ✅ Time from analysis to approval < 2 hours
- ✅ Weekly content mix within ±5% of targets
- ✅ Zero brand voice violations published
- ✅ Approval consistency across similar content (< 10% variance)

### For the Team
- 📊 Platform engagement rate > 2% (Instagram/YouTube)
- 📊 Video reach > 50,000 impressions/week
- 📊 Revision rate < 20% (means QA working well)
- 📊 Production turnaround < 3 hours per video
- 📊 Post success rate > 98% (rarely fail)

### For Audience Impact
- 📈 Increased followers week-to-week
- 📈 Comments showing understanding, not just engagement
- 📈 Shares indicating content is educational/valuable
- 📈 Watch time > 50% of video duration (people stay for info)

---

## Key Principles

1. **Guidelines > Preference**: Use established rules, not opinions
2. **Data > Gut Feel**: Let analytics guide strategy adjustments
3. **Consistency > Speed**: Better to approve slowly and consistently than fast and inconsistently
4. **Attribution > Everything**: Always verify source, creator, license
5. **Context > Brevity**: Prefer explaining complexity than oversimplifying
6. **Brand > Trending**: Stick with voice even if trending topic doesn't match tone

---

## Need Help?

- **Technical Issues**: Check API docs or contact platform specialist
- **Content Judgment Calls**: Use brand voice guidelines as reference
- **Team Coordination**: Daily standup at 9 AM
- **Strategy Questions**: Weekly review Friday mornings
