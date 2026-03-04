<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>This Is Why It Matters — Template V5</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Oswald:wght@400;500;600;700&family=DM+Sans:wght@400;500;600&display=swap');

  :root {
    --red: #FF2D2D;
    --black: #111111;
    --white: #FFFFFF;
    --yellow: #FFD400;
    --blue: #1877F2;
  }

  * { margin:0; padding:0; box-sizing:border-box; }

  body {
    background: #060606;
    font-family: 'DM Sans', sans-serif;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 48px 20px 80px;
    gap: 52px;
    overflow-x: hidden;
    position: relative;
  }

  body::before {
    content: '';
    position: fixed; inset: 0;
    background-image:
      linear-gradient(rgba(255,45,45,0.02) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,45,45,0.02) 1px, transparent 1px);
    background-size: 40px 40px;
    pointer-events: none;
  }

  .page-header {
    text-align: center;
    position: relative;
    z-index: 1;
  }

  .page-tag {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 4px;
    text-transform: uppercase;
    color: var(--yellow);
    margin-bottom: 10px;
    display: block;
  }

  .page-title {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 40px;
    letter-spacing: 3px;
    color: var(--white);
  }
  .page-title span { color: var(--red); }
  .page-sub { font-size: 12px; color: #333; margin-top: 7px; }

  /* ─── PHONES ──────────────────────────── */
  .phones-row {
    display: flex;
    gap: 28px;
    align-items: flex-start;
    flex-wrap: wrap;
    justify-content: center;
    position: relative;
    z-index: 1;
  }

  .phone-col {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  .phase-label {
    font-family: 'Oswald', sans-serif;
    font-weight: 600;
    font-size: 10px;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: var(--yellow);
    background: rgba(255,212,0,0.07);
    border: 1px solid rgba(255,212,0,0.18);
    padding: 4px 12px;
    border-radius: 20px;
  }

  .phone {
    width: 210px;
    height: 373px;
    border-radius: 34px;
    border: 2px solid #1e1e1e;
    overflow: hidden;
    position: relative;
    background: #0a0a0a;
    box-shadow: 0 0 0 1px #2a2a2a, 0 28px 60px rgba(0,0,0,0.95);
  }

  .phone::before {
    content: '';
    position: absolute;
    top: 8px; left: 50%;
    transform: translateX(-50%);
    width: 54px; height: 5px;
    background: #181818;
    border-radius: 10px;
    z-index: 100;
  }

  .vbg {
    position: absolute; inset: 0; overflow: hidden;
  }
  .vbg-a { background: radial-gradient(ellipse at 50% 35%, #182030 0%, #0c1520 55%, #060c14 100%); }
  .vbg-b { background: radial-gradient(ellipse at 50% 35%, #1c1010 0%, #0e0808 55%, #060404 100%); }
  .vbg-c { background: radial-gradient(ellipse at 50% 35%, #101820 0%, #080e14 55%, #040810 100%); }

  .fake-scene {
    position: absolute; inset: 0;
    display: flex; align-items: center; justify-content: center;
    opacity: 0.12; font-size: 60px;
  }

  /* ── BADGE ── */
  .badge {
    position: absolute;
    top: 14px; left: 10px;
    z-index: 40;
  }

  .badge-ring {
    width: 40px; height: 40px;
    border-radius: 50%;
    background: linear-gradient(145deg, #1877F2 0%, #0d5ecf 100%);
    border: 2px solid rgba(255,255,255,0.82);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    box-shadow: 0 3px 10px rgba(0,0,0,0.65);
    gap: 0;
    overflow: hidden;
  }

  .badge-top-row {
    display: flex;
    align-items: baseline;
    gap: 1px;
    line-height: 1;
  }

  .badge-w {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 17px;
    color: var(--white);
    letter-spacing: 0;
    line-height: 1;
  }

  .badge-it {
    font-family: 'Oswald', sans-serif;
    font-weight: 700;
    font-size: 7px;
    color: rgba(255,255,255,0.68);
    letter-spacing: 0.5px;
    text-transform: uppercase;
    padding-bottom: 2px;
  }

  .badge-matters {
    font-family: 'Oswald', sans-serif;
    font-weight: 700;
    font-size: 5.5px;
    color: rgba(255,255,255,0.6);
    letter-spacing: 1px;
    text-transform: uppercase;
  }

  /* ── HOOK BAR — TOP, compact ── */
  .hook-top {
    position: absolute;
    top: 0; left: 0; right: 0;
    z-index: 30;
  }

  .hook-top-body {
    background: rgba(8,8,8,0.93);
    /* Left pad clears badge, tight padding overall */
    padding: 12px 10px 8px 58px;
    border-bottom: 2px solid var(--red);
    position: relative;
  }

  /* Yellow thin second line under red */
  .hook-top-body::after {
    content: '';
    position: absolute;
    bottom: -4px; left: 0; right: 0;
    height: 2px;
    background: var(--yellow);
    opacity: 0.5;
  }

  .hook-topic {
    font-family: 'Oswald', sans-serif;
    font-weight: 600;
    font-size: 7px;
    letter-spacing: 2.5px;
    color: var(--red);
    text-transform: uppercase;
    margin-bottom: 3px;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .hook-dot {
    width: 4px; height: 4px;
    border-radius: 50%;
    background: var(--red);
    animation: blink 1s ease-in-out infinite;
  }

  @keyframes blink {
    0%,100% { opacity:1; }
    50% { opacity:0.1; }
  }

  /* Hook text — same size, just tighter container */
  .hook-text {
    font-family: 'Oswald', sans-serif;
    font-weight: 600;
    font-size: 13px;
    color: var(--white);
    line-height: 1.25;
  }

  .hook-text em {
    color: var(--yellow);
    font-style: normal;
  }

  /* ── CONTEXT BAR — BOTTOM, expanded ── */
  .context-bottom {
    position: absolute;
    bottom: 0; left: 0; right: 0;
    z-index: 30;
  }

  .context-stripe {
    height: 2px;
    background: linear-gradient(90deg,
      transparent, var(--yellow) 20%, var(--white) 50%, var(--yellow) 80%, transparent
    );
    animation: stripe 3s linear infinite;
    background-size: 200% auto;
  }

  @keyframes stripe {
    0% { background-position: 0% center; }
    100% { background-position: 200% center; }
  }

  .context-body {
    background: rgba(8,8,8,0.93);
    padding: 10px 12px 18px;
  }

  .context-eyebrow {
    font-family: 'Oswald', sans-serif;
    font-weight: 600;
    font-size: 7px;
    letter-spacing: 2.5px;
    color: var(--yellow);
    text-transform: uppercase;
    margin-bottom: 6px;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .context-eyebrow::before { content: '▸'; color: var(--red); }

  /* Bigger, more readable context text */
  .context-text {
    font-family: 'DM Sans', sans-serif;
    font-weight: 500;
    font-size: 11px;
    color: rgba(255,255,255,0.9);
    line-height: 1.55;
  }

  .context-text strong {
    color: var(--yellow);
    font-weight: 600;
  }

  /* ── OUTRO ── */
  .outro-bottom {
    position: absolute;
    bottom: 0; left: 0; right: 0;
    z-index: 35;
  }

  .outro-stripe {
    height: 2px;
    background: linear-gradient(90deg, transparent, var(--yellow) 30%, var(--white) 50%, var(--yellow) 70%, transparent);
    animation: stripe 3s linear infinite;
    background-size: 200% auto;
  }

  .outro-body {
    background: var(--red);
    padding: 12px 12px 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    position: relative;
    overflow: hidden;
  }

  .outro-body::before {
    content: '';
    position: absolute; inset: 0;
    background: repeating-linear-gradient(
      -45deg, transparent, transparent 8px,
      rgba(0,0,0,0.07) 8px, rgba(0,0,0,0.07) 9px
    );
  }

  .outro-main {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 21px;
    letter-spacing: 3px;
    color: var(--white);
    position: relative; z-index: 1;
  }

  .outro-cta {
    font-family: 'Oswald', sans-serif;
    font-weight: 700;
    font-size: 11px;
    letter-spacing: 4px;
    color: var(--yellow);
    position: relative; z-index: 1;
  }

  /* ─── BOTTOM PANELS ──────────────────── */
  .bottom-section {
    width: 100%;
    max-width: 740px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    position: relative;
    z-index: 1;
  }

  .panel {
    background: #0c0c0c;
    border: 1px solid #1a1a1a;
    border-radius: 16px;
    padding: 22px 24px;
  }

  .panel-title {
    font-family: 'Oswald', sans-serif;
    font-weight: 600;
    font-size: 9px;
    letter-spacing: 4px;
    color: #2e2e2e;
    text-transform: uppercase;
    margin-bottom: 18px;
  }

  .tl-row {
    display: grid;
    grid-template-columns: 100px 1fr;
    align-items: center;
    gap: 12px;
    margin-bottom: 8px;
  }

  .tl-label {
    font-family: 'Oswald', sans-serif;
    font-weight: 600;
    font-size: 9px;
    letter-spacing: 1.5px;
    color: #2e2e2e;
    text-transform: uppercase;
    text-align: right;
  }

  .tl-track {
    height: 24px;
    background: #111;
    border-radius: 5px;
    position: relative;
    overflow: hidden;
  }

  .tl-fill {
    position: absolute;
    top: 0; bottom: 0;
    border-radius: 5px;
    display: flex;
    align-items: center;
    padding: 0 8px;
    font-family: 'Oswald', sans-serif;
    font-weight: 600;
    font-size: 8px;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: rgba(255,255,255,0.45);
  }

  .tl-marks {
    display: grid;
    grid-template-columns: 100px 1fr;
    gap: 12px;
    margin-top: 6px;
  }

  .tl-ticks {
    display: flex;
    justify-content: space-between;
    font-size: 8px;
    color: #222;
    font-family: monospace;
  }

  .chips {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }

  .chip {
    flex: 1;
    min-width: 100px;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 11px 13px;
    background: #0f0f0f;
    border: 1px solid #1a1a1a;
    border-radius: 10px;
  }

  .swatch {
    width: 26px; height: 26px;
    border-radius: 6px;
    flex-shrink: 0;
  }

  .chip-name {
    font-family: 'Oswald', sans-serif;
    font-weight: 600;
    font-size: 11px;
    color: #fff;
    letter-spacing: 1px;
    text-transform: uppercase;
  }

  .chip-hex { font-size: 9px; color: #2e2e2e; font-family: monospace; margin-top: 1px; }
  .chip-role { font-size: 8px; color: #222; margin-top: 1px; }

  /* Change callout */
  .change-note {
    display: flex;
    gap: 14px;
    background: rgba(255,212,0,0.04);
    border: 1px solid rgba(255,212,0,0.12);
    border-radius: 12px;
    padding: 16px 18px;
  }

  .change-icon {
    font-size: 18px;
    flex-shrink: 0;
    margin-top: 1px;
  }

  .change-title {
    font-family: 'Oswald', sans-serif;
    font-weight: 600;
    font-size: 12px;
    color: var(--yellow);
    letter-spacing: 1px;
    text-transform: uppercase;
    margin-bottom: 5px;
  }

  .change-desc {
    font-size: 12px;
    color: #444;
    line-height: 1.5;
  }

  .change-desc strong { color: #666; font-weight: 600; }
</style>
</head>
<body>

<div class="page-header">
  <span class="page-tag">Template V5 — Final Layout</span>
  <div class="page-title">This Is Why It <span>Matters</span></div>
  <div class="page-sub">Compact hook · Expanded context · Blue badge · No clickbait labels</div>
</div>

<div class="phones-row">

  <!-- Phone 1: Full layout -->
  <div class="phone-col">
    <div class="phase-label">0s – 20s &nbsp;·&nbsp; Full Layout</div>
    <div class="phone">
      <div class="vbg vbg-a"><div class="fake-scene">🎙️</div></div>

      <div class="badge">
        <div class="badge-ring">
          <div class="badge-top-row">
            <div class="badge-w">W</div>
            <div class="badge-it">it</div>
          </div>
          <div class="badge-matters">Matters</div>
        </div>
      </div>

      <div class="hook-top">
        <div class="hook-top-body">
          <div class="hook-topic"><div class="hook-dot"></div>⚡ Policy Change</div>
          <div class="hook-text">This hidden policy change <em>affects you directly</em></div>
        </div>
      </div>

      <div class="context-bottom">
        <div class="context-stripe"></div>
        <div class="context-body">
          <div class="context-eyebrow">Why It Matters</div>
          <div class="context-text">A bill passed quietly through Congress that changes how <strong>millions of Americans</strong> access healthcare benefits — starting next year. Most people have no idea it happened.</div>
        </div>
      </div>
    </div>
  </div>

  <!-- Phone 2: Different topic -->
  <div class="phone-col">
    <div class="phase-label">0s – 20s &nbsp;·&nbsp; Cultural Event</div>
    <div class="phone">
      <div class="vbg vbg-b"><div class="fake-scene">🏛️</div></div>

      <div class="badge">
        <div class="badge-ring">
          <div class="badge-top-row">
            <div class="badge-w">W</div>
            <div class="badge-it">it</div>
          </div>
          <div class="badge-matters">Matters</div>
        </div>
      </div>

      <div class="hook-top">
        <div class="hook-top-body">
          <div class="hook-topic"><div class="hook-dot"></div>⚡ Social Shift</div>
          <div class="hook-text">This cultural shift is <em>reshaping community safety</em></div>
        </div>
      </div>

      <div class="context-bottom">
        <div class="context-stripe"></div>
        <div class="context-body">
          <div class="context-eyebrow">Why It Matters</div>
          <div class="context-text">Local governments across <strong>12 states</strong> quietly changed how public safety funding works. The ripple effects are already hitting neighborhoods — and it's accelerating.</div>
        </div>
      </div>
    </div>
  </div>

  <!-- Phone 3: Outro -->
  <div class="phone-col">
    <div class="phase-label">26s – 30s &nbsp;·&nbsp; Outro CTA</div>
    <div class="phone">
      <div class="vbg vbg-c"><div class="fake-scene">📺</div></div>

      <div class="badge">
        <div class="badge-ring">
          <div class="badge-top-row">
            <div class="badge-w">W</div>
            <div class="badge-it">it</div>
          </div>
          <div class="badge-matters">Matters</div>
        </div>
      </div>

      <div class="hook-top">
        <div class="hook-top-body">
          <div class="hook-topic"><div class="hook-dot"></div>⚡ Policy Change</div>
          <div class="hook-text">This hidden policy change <em>affects you directly</em></div>
        </div>
      </div>

      <div class="outro-bottom">
        <div class="outro-stripe"></div>
        <div class="outro-body">
          <div class="outro-main">Follow For More</div>
          <div class="outro-cta">↓ &nbsp; Subscribe &nbsp; ↓</div>
        </div>
      </div>
    </div>
  </div>

</div>

<!-- Panels -->
<div class="bottom-section">

  <!-- Change note -->
  <div class="change-note">
    <div class="change-icon">✦</div>
    <div>
      <div class="change-title">What Changed in V5</div>
      <div class="change-desc">
        <strong>Removed</strong> "Nobody's talking about this" — the hook does the work on its own.<br>
        <strong>Hook bar</strong> is now compact — just topic tag + one punchy line.<br>
        <strong>Context bar</strong> is taller with bigger text — this is the channel's value, it deserves the space.<br>
        <strong>Topic tag</strong> replaces the eyebrow label, showing the content pillar (Policy Change, Social Shift, etc).
      </div>
    </div>
  </div>

  <!-- Timeline -->
  <div class="panel">
    <div class="panel-title">30-Second Timeline</div>

    <div class="tl-row">
      <div class="tl-label">Badge</div>
      <div class="tl-track">
        <div class="tl-fill" style="left:0;width:100%;background:rgba(24,119,242,0.22);border:1px solid rgba(24,119,242,0.35);">Always On</div>
      </div>
    </div>

    <div class="tl-row">
      <div class="tl-label">Hook (top)</div>
      <div class="tl-track">
        <div class="tl-fill" style="left:0;width:100%;background:rgba(255,45,45,0.18);border:1px solid rgba(255,45,45,0.32);">Entire Video</div>
      </div>
    </div>

    <div class="tl-row">
      <div class="tl-label">Context (btm)</div>
      <div class="tl-track">
        <div class="tl-fill" style="left:0;width:67%;background:rgba(255,212,0,0.12);border:1px solid rgba(255,212,0,0.25);">0s – 20s (expanded)</div>
      </div>
    </div>

    <div class="tl-row">
      <div class="tl-label">Outro CTA</div>
      <div class="tl-track">
        <div class="tl-fill" style="left:87%;width:13%;background:rgba(255,45,45,0.65);border:1px solid rgba(255,45,45,0.9);">CTA</div>
      </div>
    </div>

    <div class="tl-marks">
      <div></div>
      <div class="tl-ticks">
        <span>0s</span><span>5s</span><span>10s</span><span>15s</span><span>20s</span><span>25s</span><span>30s</span>
      </div>
    </div>
  </div>

  <!-- Colors -->
  <div class="panel">
    <div class="panel-title">Brand Colors</div>
    <div class="chips">
      <div class="chip">
        <div class="swatch" style="background:#FF2D2D;box-shadow:0 3px 10px rgba(255,45,45,0.35);"></div>
        <div><div class="chip-name">Red</div><div class="chip-hex">#FF2D2D</div><div class="chip-role">Hook border · Outro</div></div>
      </div>
      <div class="chip">
        <div class="swatch" style="background:#111111;border:1px solid #2a2a2a;"></div>
        <div><div class="chip-name">Black</div><div class="chip-hex">#111111</div><div class="chip-role">Overlay backgrounds</div></div>
      </div>
      <div class="chip">
        <div class="swatch" style="background:#FFFFFF;"></div>
        <div><div class="chip-name">White</div><div class="chip-hex">#FFFFFF</div><div class="chip-role">All text</div></div>
      </div>
      <div class="chip">
        <div class="swatch" style="background:#FFD400;box-shadow:0 3px 10px rgba(255,212,0,0.3);"></div>
        <div><div class="chip-name">Yellow</div><div class="chip-hex">#FFD400</div><div class="chip-role">Accents · Highlights · CTA</div></div>
      </div>
      <div class="chip">
        <div class="swatch" style="background:#1877F2;box-shadow:0 3px 10px rgba(24,119,242,0.3);"></div>
        <div><div class="chip-name">Blue</div><div class="chip-hex">#1877F2</div><div class="chip-role">Badge only</div></div>
      </div>
    </div>
  </div>

</div>

</body>
</html>
