'use client';

import React, { useState, useEffect } from 'react';

interface DirectorBrief {
  totalPending: number;
  criticalIssues: number;
  readyForProduction: number;
  byPillar: Record<string, number>;
  upcomingQuota: number;
}

interface ApprovalStats {
  pending: number;
  inReview: number;
  approvedToday: number;
  rejectedToday: number;
  averageReviewTime: number;
}

interface QueueStats {
  summary: {
    total: number;
    pending: number;
    failed: number;
    posted: number;
    scheduled: number;
    readyToPost: number;
  };
  byPlatform: Record<string, {
    total: number;
    pending: number;
    failed: number;
    posted: number;
  }>;
  nextScheduled: {
    platform: string;
    scheduledFor: string;
    hasVideo: boolean;
  } | null;
  recentFailures: Array<{
    id: string;
    platform: string;
    error: string;
    timestamp: string;
  }>;
}

interface ContentDashboardData {
  directorBrief: DirectorBrief;
  approvalStats: ApprovalStats;
  weeklyAnalytics: any;
}

export function ContentManagementPanel() {
  const [dashboardData, setDashboardData] = useState<ContentDashboardData | null>(null);
  const [queueStats, setQueueStats] = useState<QueueStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeBriefCard, setActiveBriefCard] = useState<string | null>(null);
  const [activeAnalyticsCard, setActiveAnalyticsCard] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const [contentRes, queueRes] = await Promise.all([
          fetch('/api/content'),
          fetch('/api/queue/stats'),
        ]);
        
        const contentData = await contentRes.json();
        const queueData = await queueRes.json();
        
        if (contentData.success) {
          setDashboardData(contentData.data);
        }
        
        if (queueData.success) {
          setQueueStats(queueData.data);
        }
      } catch (error) {
        console.error('Failed to load content dashboard:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
    const interval = setInterval(fetchDashboard, 60000); // refresh every minute
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <section className="zone">
        <div className="panel">
          <p>Loading content management dashboard...</p>
        </div>
      </section>
    );
  }

  const brief = dashboardData?.directorBrief;
  const stats = dashboardData?.approvalStats;

  const selectedInsight = (() => {
    if (activeBriefCard === 'pending') {
      return 'QA queue is selected. Review pending items first to keep publish cadence on schedule.';
    }
    if (activeBriefCard === 'critical') {
      return 'Critical issues are selected. Prioritize items below quality threshold before publishing.';
    }
    if (activeBriefCard === 'ready') {
      return 'Ready-for-production items are selected. These can move directly into queueing.';
    }
    if (activeBriefCard === 'quota') {
      return 'Weekly quota is selected. Use this to gauge whether additional content production is needed.';
    }

    if (activeAnalyticsCard === 'totalVideos') {
      return 'Total videos posted this week is selected for quick volume tracking.';
    }
    if (activeAnalyticsCard === 'engagement') {
      return 'Engagement rate is selected. Compare this against your virality threshold.';
    }
    if (activeAnalyticsCard === 'bestTime') {
      return 'Best posting time is selected. Schedule new queue entries around this window.';
    }
    if (activeAnalyticsCard === 'viralThreshold') {
      return 'Virality threshold is selected. Clips above this rate should be repurposed across platforms.';
    }

    return null;
  })();

  return (
    <>
      {/* Posting Queue Status */}
      <section className="zone zone-primary content-management">
        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>📤 Posting Queue Status</h2>
              <p>Videos queued for publishing across platforms</p>
            </div>
          </div>
          <div className="brief-grid">
            <div className="brief-card status-ready">
              <span className="label">Ready to Post</span>
              <strong className="number">{queueStats?.summary.readyToPost || 0}</strong>
              <span className="detail">Finalized videos</span>
            </div>
            <div className="brief-card status-pending">
              <span className="label">Scheduled</span>
              <strong className="number">{queueStats?.summary.scheduled || 0}</strong>
              <span className="detail">Awaiting publish time</span>
            </div>
            <div className="brief-card status-quota">
              <span className="label">Posted</span>
              <strong className="number">{queueStats?.summary.posted || 0}</strong>
              <span className="detail">Successfully published</span>
            </div>
            <div className="brief-card status-critical">
              <span className="label">Failed</span>
              <strong className="number">{queueStats?.summary.failed || 0}</strong>
              <span className="detail">Need attention</span>
            </div>
          </div>
          
          {queueStats?.summary.readyToPost === 0 && queueStats?.summary.scheduled === 0 && (
            <div style={{ marginTop: '1rem', padding: '1rem', background: '#f0f0f0', borderRadius: '4px' }}>
              <p style={{ margin: 0, color: '#666' }}>
                ℹ️ No videos currently queued for posting. Videos need to be finalized and queued before they can be published.
              </p>
            </div>
          )}
          
          {queueStats && queueStats.summary.readyToPost > 0 && (
            <div style={{ marginTop: '1rem', padding: '1rem', background: '#e8f5e9', borderRadius: '4px' }}>
              <p style={{ margin: 0, color: '#2e7d32', fontWeight: 500 }}>
                ✅ {queueStats.summary.readyToPost} video{queueStats.summary.readyToPost !== 1 ? 's' : ''} ready to publish
              </p>
            </div>
          )}
          
          {queueStats?.nextScheduled && (
            <div style={{ marginTop: '1rem', padding: '1rem', background: '#e3f2fd', borderRadius: '4px' }}>
              <p style={{ margin: 0, color: '#1565c0' }}>
                ⏰ Next post: <strong>{queueStats.nextScheduled.platform}</strong> at{' '}
                {new Date(queueStats.nextScheduled.scheduledFor).toLocaleString()}
                {!queueStats.nextScheduled.hasVideo && ' (⚠️ video not finalized)'}
              </p>
            </div>
          )}
          
          {queueStats && Object.keys(queueStats.byPlatform).length > 0 && (
            <div style={{ marginTop: '1rem' }}>
              <h4 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' }}>By Platform:</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.5rem' }}>
                {Object.entries(queueStats.byPlatform).map(([platform, stats]) => (
                  <div key={platform} style={{ padding: '0.5rem', background: '#f5f5f5', borderRadius: '4px' }}>
                    <div style={{ fontSize: '0.75rem', color: '#666', textTransform: 'capitalize' }}>{platform.replace('_', ' ')}</div>
                    <div style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
                      <span style={{ color: '#4caf50' }}>✓{stats.posted}</span>
                      {' · '}
                      <span style={{ color: '#ff9800' }}>⏳{stats.pending}</span>
                      {' · '}
                      <span style={{ color: '#f44336' }}>✗{stats.failed}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {queueStats && queueStats.recentFailures.length > 0 && (
            <details style={{ marginTop: '1rem', padding: '1rem', background: '#fff3e0', borderRadius: '4px' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 500, color: '#e65100' }}>
                ⚠️ Recent Failures ({queueStats.recentFailures.length})
              </summary>
              <div style={{ marginTop: '0.5rem' }}>
                {queueStats.recentFailures.map((failure) => (
                  <div key={failure.id} style={{ padding: '0.5rem', background: 'white', borderRadius: '4px', marginTop: '0.5rem' }}>
                    <div style={{ fontSize: '0.75rem', color: '#666' }}>
                      <strong>{failure.platform}</strong> · {new Date(failure.timestamp).toLocaleString()}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#d32f2f', marginTop: '0.25rem' }}>
                      {failure.error}
                    </div>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      </section>

      {/* Director&apos;s Brief */}
      <section className="zone zone-primary content-management">
        <div className="panel director-brief">
          <div className="panel-header">
            <div>
              <h2>📋 Director&apos;s Brief</h2>
              <p>Content status, quality gates, and production readiness</p>
            </div>
          </div>
          <div className="brief-grid">
            <button
              type="button"
              className={`brief-card status-pending ${activeBriefCard === 'pending' ? 'is-active' : ''}`}
              onClick={() => {
                setActiveBriefCard('pending');
                setActiveAnalyticsCard(null);
              }}
            >
              <span className="label">QA Pending</span>
              <strong className="number">{brief?.totalPending || 0}</strong>
              <span className="detail">Awaiting review</span>
            </button>
            <button
              type="button"
              className={`brief-card status-critical ${activeBriefCard === 'critical' ? 'is-active' : ''}`}
              onClick={() => {
                setActiveBriefCard('critical');
                setActiveAnalyticsCard(null);
              }}
            >
              <span className="label">Critical Issues</span>
              <strong className="number">{brief?.criticalIssues || 0}</strong>
              <span className="detail">Below 50% quality</span>
            </button>
            <button
              type="button"
              className={`brief-card status-ready ${activeBriefCard === 'ready' ? 'is-active' : ''}`}
              onClick={() => {
                setActiveBriefCard('ready');
                setActiveAnalyticsCard(null);
              }}
            >
              <span className="label">Ready for Production</span>
              <strong className="number">{brief?.readyForProduction || 0}</strong>
              <span className="detail">Approved & waiting</span>
            </button>
            <button
              type="button"
              className={`brief-card status-quota ${activeBriefCard === 'quota' ? 'is-active' : ''}`}
              onClick={() => {
                setActiveBriefCard('quota');
                setActiveAnalyticsCard(null);
              }}
            >
              <span className="label">Weekly Quota</span>
              <strong className="number">{brief?.upcomingQuota || 5}</strong>
              <span className="detail">Posts needed</span>
            </button>
          </div>
          {selectedInsight && <p className="card-selection-hint">{selectedInsight}</p>}
        </div>

        {/* Approval Workflow Status */}
        <aside className="panel approval-status">
          <div className="panel-header">
            <h3>Review Workflow</h3>
          </div>
          <div className="workflow-stats">
            <div className="stat">
              <span className="value">{stats?.pending || 0}</span>
              <span className="label">Pending Review</span>
            </div>
            <div className="stat">
              <span className="value">{stats?.inReview || 0}</span>
              <span className="label">In Review</span>
            </div>
            <div className="stat success">
              <span className="value">{stats?.approvedToday || 0}</span>
              <span className="label">Approved Today</span>
            </div>
            <div className="stat alert">
              <span className="value">{stats?.rejectedToday || 0}</span>
              <span className="label">Revisions Requested</span>
            </div>
          </div>
          <div className="efficiency">
            <span className="metric">Avg Review Time</span>
            <strong>{stats?.averageReviewTime || 0}h</strong>
          </div>
        </aside>
      </section>

      {/* Content Quality Standards */}
      <section className="zone content-standards">
        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>✓ Content Quality Standards</h2>
              <p>Every piece must meet our editorial guidelines before posting</p>
            </div>
            <button className="ghost-btn">View Guidelines</button>
          </div>
          <div className="standards-list">
            <div className="standard">
              <div className="check">✓</div>
              <div>
                <strong>Hook Strength (7/10 min)</strong>
                <p>Must create curiosity or emotional pull in first 5 words</p>
              </div>
            </div>
            <div className="standard">
              <div className="check">✓</div>
              <div>
                <strong>Explanation Clarity (7/10 min)</strong>
                <p>Readers should understand context and significance</p>
              </div>
            </div>
            <div className="standard">
              <div className="check">✓</div>
              <div>
                <strong>Cultural Relevance (6/10 min)</strong>
                <p>Content must address timely or evergreen topics people care about</p>
              </div>
            </div>
            <div className="standard">
              <div className="check">✓</div>
              <div>
                <strong>Tone Alignment</strong>
                <p>Must be informative, compelling, accessible, measured (not sensational)</p>
              </div>
            </div>
            <div className="standard">
              <div className="check">✓</div>
              <div>
                <strong>Source Attribution</strong>
                <p>Source, creator, license, and URL must be listed for tracking</p>
              </div>
            </div>
            <div className="standard">
              <div className="check">✓</div>
              <div>
                <strong>Platform Optimization</strong>
                <p>Hashtags, timing, and copy tailored to Instagram/Facebook/YouTube</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Performance Analytics */}
      <section className="zone content-analytics">
        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>📊 Weekly Performance</h2>
              <p>Track engagement, reach, and content effectiveness</p>
            </div>
            <button className="ghost-btn">Full Analytics</button>
          </div>
          <div className="analytics-grid">
            <button
              type="button"
              className={`analytic-card ${activeAnalyticsCard === 'totalVideos' ? 'is-active' : ''}`}
              onClick={() => {
                setActiveAnalyticsCard('totalVideos');
                setActiveBriefCard(null);
              }}
            >
              <span className="metric">Total Videos Posted</span>
              <strong className="value">
                {dashboardData?.weeklyAnalytics?.totalVideos || 0}
              </strong>
            </button>
            <button
              type="button"
              className={`analytic-card highlight ${activeAnalyticsCard === 'engagement' ? 'is-active' : ''}`}
              onClick={() => {
                setActiveAnalyticsCard('engagement');
                setActiveBriefCard(null);
              }}
            >
              <span className="metric">Avg Engagement Rate</span>
              <strong className="value">
                {(dashboardData?.weeklyAnalytics?.platforms?.instagram?.avgEngagementRate || 0).toFixed(
                  1
                )}%
              </strong>
            </button>
            <button
              type="button"
              className={`analytic-card ${activeAnalyticsCard === 'bestTime' ? 'is-active' : ''}`}
              onClick={() => {
                setActiveAnalyticsCard('bestTime');
                setActiveBriefCard(null);
              }}
            >
              <span className="metric">Best Posting Time</span>
              <strong className="value">
                {dashboardData?.weeklyAnalytics?.trends?.bestPostingTime || '18:00 UTC'}
              </strong>
            </button>
            <button
              type="button"
              className={`analytic-card ${activeAnalyticsCard === 'viralThreshold' ? 'is-active' : ''}`}
              onClick={() => {
                setActiveAnalyticsCard('viralThreshold');
                setActiveBriefCard(null);
              }}
            >
              <span className="metric">Viral Threshold</span>
              <strong className="value">
                {dashboardData?.weeklyAnalytics?.trends?.virialityThreshold || 5}%
              </strong>
            </button>
          </div>
          {selectedInsight && <p className="card-selection-hint">{selectedInsight}</p>}
        </div>
      </section>

      {/* Editorial Calendar & Content Pillars */}
      <section className="zone content-pillars">
        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>📅 Editorial Calendar</h2>
              <p>This week&apos;s theme and content pillar distribution targets</p>
            </div>
          </div>
          <div className="calendar-info">
            <div className="theme-box">
              <h3>This Week&apos;s Theme</h3>
              <p className="theme-name">
                {brief && Object.keys(brief.byPillar).length > 0
                  ? 'Democracy & Participation'
                  : 'Loading...'}
              </p>
              <p className="theme-description">
                How democratic systems are shaped and evolve through citizen action
              </p>
            </div>
            <div className="pillar-distribution">
              <h4>Content Pillar Targets</h4>
              <div className="pillar-bars">
                {brief && Object.entries(brief.byPillar).map(([pillar, count]) => (
                  <div key={pillar} className="pillar-bar">
                    <span className="pillar-name">{pillar.replace(/_/g, ' ')}</span>
                    <div className="bar-container">
                      <div className="bar-fill" style={{ width: `${(count / (brief.readyForProduction + brief.totalPending + 1)) * 100}%` }}>
                        {count}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
