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

interface ContentDashboardData {
  directorBrief: DirectorBrief;
  approvalStats: ApprovalStats;
  weeklyAnalytics: any;
}

export function ContentManagementPanel() {
  const [dashboardData, setDashboardData] = useState<ContentDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const response = await fetch('/api/content');
        const data = await response.json();
        if (data.success) {
          setDashboardData(data.data);
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

  return (
    <>
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
            <div className="brief-card status-pending">
              <span className="label">QA Pending</span>
              <strong className="number">{brief?.totalPending || 0}</strong>
              <span className="detail">Awaiting review</span>
            </div>
            <div className="brief-card status-critical">
              <span className="label">Critical Issues</span>
              <strong className="number">{brief?.criticalIssues || 0}</strong>
              <span className="detail">Below 50% quality</span>
            </div>
            <div className="brief-card status-ready">
              <span className="label">Ready for Production</span>
              <strong className="number">{brief?.readyForProduction || 0}</strong>
              <span className="detail">Approved & waiting</span>
            </div>
            <div className="brief-card status-quota">
              <span className="label">Weekly Quota</span>
              <strong className="number">{brief?.upcomingQuota || 5}</strong>
              <span className="detail">Posts needed</span>
            </div>
          </div>
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
            <div className="analytic-card">
              <span className="metric">Total Videos Posted</span>
              <strong className="value">
                {dashboardData?.weeklyAnalytics?.totalVideos || 0}
              </strong>
            </div>
            <div className="analytic-card highlight">
              <span className="metric">Avg Engagement Rate</span>
              <strong className="value">
                {(dashboardData?.weeklyAnalytics?.platforms?.instagram?.avgEngagementRate || 0).toFixed(
                  1
                )}%
              </strong>
            </div>
            <div className="analytic-card">
              <span className="metric">Best Posting Time</span>
              <strong className="value">
                {dashboardData?.weeklyAnalytics?.trends?.bestPostingTime || '18:00 UTC'}
              </strong>
            </div>
            <div className="analytic-card">
              <span className="metric">Viral Threshold</span>
              <strong className="value">
                {dashboardData?.weeklyAnalytics?.trends?.virialityThreshold || 5}%
              </strong>
            </div>
          </div>
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
