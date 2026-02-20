import { ContentManagementPanel } from '@/src/components/ContentManagementPanel';
import { AttentionPanel, AttentionStatus } from '@/src/components/AttentionPanel';
import { PublishNow } from '@/src/components/PublishNow';

export default function Home() {
  return (
    <main className="dashboard">
      {/* Content Management & Direction Section */}
      <ContentManagementPanel />

      <header className="topbar">
        <div>
          <p className="eyebrow">Viral Clip Engine</p>
          <h1>Posting Control Room</h1>
          <p className="subhead">
            One master template. Four platform outputs. Every clip moves through Draft →
            Scheduled → Posting → Posted/Failed.
          </p>
        </div>
        <div className="status-stack">
          <PublishNow />
          <AttentionStatus />
          <div className="status-card ghost">
            <span className="label">Next Post</span>
            <strong>Today · 6:45 PM</strong>
          </div>
        </div>
      </header>

      <section className="zone zone-primary">
        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Queue & Calendar</h2>
              <p>Timeline view across Instagram, Facebook, YouTube.</p>
            </div>
            <div className="chip-row">
              <span className="chip">Scheduled</span>
              <span className="chip chip-success">Posted</span>
              <span className="chip chip-alert">Failed</span>
            </div>
          </div>
          <div className="timeline">
            <div className="timeline-row">
              <span className="time">Today 09:30</span>
              <span className="pill ig">Instagram</span>
              <div className="timeline-card">
                <strong>Policy Shift: Housing Rents</strong>
                <span>Scheduled · Hook: “Nobody’s talking about this...”</span>
              </div>
            </div>
            <div className="timeline-row">
              <span className="time">Today 12:00</span>
              <span className="pill yt">YouTube Shorts</span>
              <div className="timeline-card">
                <strong>1968 Convention Riot</strong>
                <span>Posted · 18.2k views</span>
              </div>
            </div>
            <div className="timeline-row">
              <span className="time">Today 15:00</span>
              <span className="pill fb">Facebook</span>
              <div className="timeline-card alert">
                <strong>Public Reaction: City Walkout</strong>
                <span>Failed · Needs review</span>
              </div>
            </div>
          </div>
        </div>
        <AttentionPanel />
      </section>

      <section className="zone">
        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Content Library</h2>
              <p>Filter by platform, date, and performance tier.</p>
            </div>
            <div className="filter-row">
              <button className="filter">All</button>
              <button className="filter">Instagram</button>
              <button className="filter">Facebook</button>
              <button className="filter">YouTube</button>
              <button className="filter">Viral</button>
            </div>
          </div>
          <div className="library-grid">
            {[
              { title: 'City Protest, 1994', status: 'Scheduled', tier: 'Viral' },
              { title: 'Policy Shift: Rent Caps', status: 'Draft', tier: 'Normal' },
              { title: 'Public Reaction: Metro', status: 'Posted', tier: 'Viral' },
              { title: 'Historic PSA, 1952', status: 'Failed', tier: 'Underperforming' },
            ].map((item) => (
              <div className="library-card" key={item.title}>
                <div className="thumb" />
                <div className="card-body">
                  <h4>{item.title}</h4>
                  <p>Hook: “This is bigger than you think...”</p>
                  <div className="card-meta">
                    <span className="badge">{item.status}</span>
                    <span className="badge ghost">{item.tier}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Analytics Panel</h2>
              <p>Rollups + trendlines across platforms.</p>
            </div>
          </div>
          <div className="analytics-grid">
            <div className="stat-card">
              <span className="label">Best Clip This Week</span>
              <strong>“1968 Convention Riot”</strong>
              <p>54.8k views · 2.1k shares</p>
            </div>
            <div className="stat-card">
              <span className="label">Best Platform</span>
              <strong>YouTube Shorts</strong>
              <p>+312 followers · 9.2% engagement</p>
            </div>
            <div className="stat-card">
              <span className="label">Best Time</span>
              <strong>12:00–3:00 PM</strong>
              <p>Consistent lift over 8 weeks</p>
            </div>
            <div className="trend-card">
              <span className="label">Trendline</span>
              <div className="trendline" />
              <p>Engagement up 14% MoM</p>
            </div>
          </div>
        </div>
      </section>

      <section className="zone zone-secondary">
        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Master Posting Template</h2>
              <p>Core fields that adapt per platform.</p>
            </div>
          </div>
          <form className="template-form">
            <div className="form-grid">
              <label>
                Clip File
                <input type="text" placeholder="supabase://final_videos/clip.mp4" />
              </label>
              <label>
                Hook (1–3s)
                <input type="text" placeholder="Nobody’s talking about..." />
              </label>
              <label className="full">
                Caption Body
                <textarea placeholder="Short, direct, context-first." rows={4} />
              </label>
              <label>
                CTA
                <input type="text" placeholder="Save this / Comment below" />
              </label>
              <label>
                Thumbnail
                <input type="text" placeholder="/thumbnails/clip.jpg" />
              </label>
              <label>
                Scheduled Date/Time
                <input type="datetime-local" />
              </label>
              <label className="full">
                Hashtags (per platform)
                <div className="tag-grid">
                  <input type="text" placeholder="Instagram hashtags" />
                  <input type="text" placeholder="Facebook hashtags" />
                  <input type="text" placeholder="YouTube hashtags" />
                </div>
              </label>
            </div>
            <div className="platform-toggles">
              <span className="label">Platforms</span>
              <label className="toggle">
                <input type="checkbox" defaultChecked /> Instagram
              </label>
              <label className="toggle">
                <input type="checkbox" defaultChecked /> Facebook
              </label>
              <label className="toggle">
                <input type="checkbox" defaultChecked /> YouTube Shorts
              </label>
              <label className="toggle disabled">
                <input type="checkbox" disabled /> TikTok (later)
              </label>
            </div>
          </form>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Platform Overrides</h2>
              <p>Override fields below the master template.</p>
            </div>
          </div>
          <div className="override-grid">
            <div className="override-card">
              <h3>Instagram</h3>
              <label>
                Alt Text
                <input type="text" placeholder="Describe what’s shown" />
              </label>
              <label>
                Collab Tag
                <input type="text" placeholder="@partner" />
              </label>
            </div>
            <div className="override-card">
              <h3>YouTube Shorts</h3>
              <label>
                Title
                <input type="text" placeholder="Topic — This Is Why It Matters" />
              </label>
              <label>
                Category
                <input type="text" placeholder="News & Politics" />
              </label>
              <label className="toggle">
                <input type="checkbox" /> Feed into long-form
              </label>
            </div>
            <div className="override-card">
              <h3>Facebook</h3>
              <label>
                Audience
                <select>
                  <option>Public</option>
                  <option>Page</option>
                  <option>Group</option>
                </select>
              </label>
              <label className="toggle">
                <input type="checkbox" /> Cross-post from Instagram
              </label>
            </div>
            <div className="override-card disabled">
              <h3>TikTok (later)</h3>
              <label>
                Duet/Stitch
                <input type="text" disabled placeholder="Disabled" />
              </label>
              <label>
                Trending Audio
                <input type="text" disabled placeholder="Disabled" />
              </label>
            </div>
          </div>
        </div>
      </section>

      <section className="zone zone-secondary">
        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Settings & Template Manager</h2>
              <p>Reusable captions, hashtag sets, CTAs, and schedule rules.</p>
            </div>
          </div>
          <div className="settings-grid">
            <div className="settings-card">
              <h4>Caption Templates</h4>
              <p>3 active · 1 draft</p>
              <button className="ghost-btn">Edit Templates</button>
            </div>
            <div className="settings-card">
              <h4>Hashtag Sets</h4>
              <p>Instagram · Facebook · YouTube</p>
              <button className="ghost-btn">Manage Sets</button>
            </div>
            <div className="settings-card">
              <h4>Posting Rules</h4>
              <p>Weekday scheduling and priority map</p>
              <button className="ghost-btn">View Calendar Logic</button>
            </div>
            <div className="settings-card">
              <h4>Connected Accounts</h4>
              <p>Instagram, Facebook, YouTube</p>
              <button className="ghost-btn">Manage Access</button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
