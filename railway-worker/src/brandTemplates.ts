/**
 * brandTemplates.ts
 * "This Is Why It Matters" — V6 Brand Template
 *
 * Layout (1080x1920 vertical frame):
 * ┌─────────────────────────────────┐
 * │  [HOOK BAR ~124px]              │  ← Black bg, red border, yellow accent
 * │  Badge(top-left) + Topic + Hook │
 * ├─────────────────────────────────┤
 * │  [BLACK PAD ~532px]             │  ← Hidden letterbox padding top
 * ├─────────────────────────────────┤
 * │  [VIDEO ZONE ~608px]            │  ← Horizontal clip, natural aspect ratio
 * ├─────────────────────────────────┤
 * │  [BLACK PAD hidden by context]  │
 * ├─────────────────────────────────┤
 * │  [CONTEXT BAR ~204px]           │  ← Yellow stripe, explanation text
 * └─────────────────────────────────┘
 *
 * Colors:
 *   #FF2D2D  Red    — hook border, topic tag, outro bg
 *   #111111  Black  — overlay backgrounds
 *   #FFFFFF  White  — all text
 *   #FFD400  Yellow — accent lines, highlights, CTA
 *   #1877F2  Blue   — badge only
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WordCaption {
  word: string;
  start: number;
  end: number;
}

export interface BrandTemplateOptions {
  hook: string;
  context: string;
  contentPillar?: string;
  videoDuration?: number;
  addOutro?: boolean;
}

// ─── Text Helpers ─────────────────────────────────────────────────────────────

/**
 * Sanitize a string for safe use inside an FFmpeg drawtext filter.
 */
function sanitize(text: string, maxLen = 120): string {
  return text
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, '\u2019')
    .replace(/:/g, '\\:')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
    .replace(/=/g, '\\=')
    .replace(/%/g, '\\%')
    .trim()
    .substring(0, maxLen);
}

/**
 * Word-wrap text to a max character width per line.
 */
function wordWrap(text: string, maxChars = 32, maxLines = 3): string {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    if (current && (current + ' ' + word).length > maxChars) {
      lines.push(current);
      current = word;
    } else {
      current = current ? `${current} ${word}` : word;
    }
    if (lines.length >= maxLines) break;
  }

  if (current && lines.length < maxLines) {
    lines.push(current);
  }

  return lines.join('\n');
}

// ─── Main Filter Builder ──────────────────────────────────────────────────────

/**
 * Build the complete FFmpeg -vf filter chain for the V6 brand template.
 *
 * Input: any horizontal (16:9) video clip
 * Output: 1080x1920 vertical frame with brand overlays
 */
export function buildBrandedVideoFilter(options: BrandTemplateOptions): string {
  const {
    hook,
    context,
    contentPillar = 'Breaking',
    videoDuration = 30,
    addOutro = true,
  } = options;

  const hookText    = sanitize(wordWrap(hook, 34, 2));
  const contextText = sanitize(wordWrap(context, 36, 4));
  const pillarText  = sanitize(`⚡ ${contentPillar}`, 30);
  const outroStart  = Math.max(videoDuration - 4, videoDuration * 0.87);
  const contextEnd  = outroStart;

  const f: string[] = [];

  // ── 1. SCALE + PAD — horizontal video into vertical frame ────────────────
  // Scale horizontal clip to 1080px wide, preserve aspect ratio
  f.push('scale=1080:608:force_original_aspect_ratio=decrease:flags=lanczos');
  // Pad to 1920px height — video zone sits at y=656
  f.push('pad=1080:1920:0:656:black');

  // ── 2. BADGE — blue circle, top-left ─────────────────────────────────────
  f.push('drawbox=x=18:y=18:w=82:h=82:color=0x1877F2@1.0:t=fill');
  f.push('drawbox=x=18:y=18:w=82:h=82:color=0xFFFFFF@0.85:t=2');
  f.push(`drawtext=text='W':fontsize=44:fontcolor=white:x=30:y=22:shadowx=1:shadowy=1:shadowcolor=black@0.5`);
  f.push(`drawtext=text='it':fontsize=17:fontcolor=white@0.68:x=63:y=44`);
  f.push(`drawtext=text='MATTERS':fontsize=11:fontcolor=white@0.62:x=21:y=80:letter_spacing=1`);

  // ── 3. HOOK BAR — top, compact ────────────────────────────────────────────
  f.push('drawbox=x=0:y=0:w=iw:h=124:color=0x080808@0.94:t=fill');
  f.push('drawbox=x=0:y=120:w=iw:h=4:color=0xFF2D2D@1.0:t=fill');
  f.push('drawbox=x=0:y=124:w=iw:h=2:color=0xFFD400@0.55:t=fill');
  f.push(`drawtext=text='${pillarText}':fontsize=22:fontcolor=0xFF2D2D:x=112:y=26`);
  f.push(
    `drawtext=text='${hookText}'` +
    `:fontsize=34:fontcolor=white` +
    `:borderw=1:bordercolor=black@0.6` +
    `:shadowx=2:shadowy=2:shadowcolor=black@0.7` +
    `:x=112:y=54:line_spacing=5`
  );

  // ── 4. CONTEXT BAR — bottom, expanded ─────────────────────────────────────
  const ctxE = `enable='between(t\\,0\\,${contextEnd})'`;
  f.push(`drawbox=x=0:y=ih-204:w=iw:h=3:color=0xFFD400@0.92:t=fill:${ctxE}`);
  f.push(`drawbox=x=0:y=ih-201:w=iw:h=201:color=0x080808@0.94:t=fill:${ctxE}`);
  f.push(`drawtext=text='▸ WHY IT MATTERS':fontsize=20:fontcolor=0xFFD400:x=18:y=ih-192:${ctxE}`);
  f.push(
    `drawtext=text='${contextText}'` +
    `:fontsize=30:fontcolor=white@0.92` +
    `:borderw=1:bordercolor=black@0.4` +
    `:x=18:y=ih-166:line_spacing=8` +
    `:${ctxE}`
  );

  // ── 5. OUTRO — last 4 seconds ─────────────────────────────────────────────
  if (addOutro) {
    const outE = `enable='between(t\\,${outroStart}\\,${videoDuration})'`;
    f.push(`drawbox=x=0:y=ih-134:w=iw:h=3:color=0xFFD400@1.0:t=fill:${outE}`);
    f.push(`drawbox=x=0:y=ih-131:w=iw:h=131:color=0xFF2D2D@0.97:t=fill:${outE}`);
    // Subtle diagonal texture
    for (let i = 0; i < 9; i++) {
      f.push(`drawbox=x=${i * 130 - 20}:y=ih-131:w=2:h=131:color=black@0.06:t=fill:${outE}`);
    }
    f.push(`drawtext=text='FOLLOW FOR MORE':fontsize=46:fontcolor=white:x=(w-text_w)/2:y=ih-112:${outE}`);
    f.push(`drawtext=text='↓  SUBSCRIBE  ↓':fontsize=30:fontcolor=0xFFD400:x=(w-text_w)/2:y=ih-58:${outE}`);
  }

  return f.join(',');
}

// ─── Caption Filter Builder ───────────────────────────────────────────────────

/**
 * Build drawtext filters for Whisper word-level captions.
 * Groups words into 3-word chunks shown center-screen in the video zone.
 */
export function buildCaptionFilters(captions: WordCaption[]): string {
  if (!captions || captions.length === 0) return '';

  const chunks: Array<{ text: string; start: number; end: number }> = [];
  for (let i = 0; i < captions.length; i += 3) {
    const group = captions.slice(i, i + 3);
    if (!group.length) continue;
    chunks.push({
      text: group.map(w => w.word).join(' '),
      start: group[0].start,
      end: group[group.length - 1].end,
    });
  }

  return chunks
    .map(chunk => {
      const t = sanitize(chunk.text, 50);
      return (
        `drawtext=text='${t}'` +
        `:fontsize=54:fontcolor=white` +
        `:borderw=3:bordercolor=black@0.92` +
        `:shadowx=2:shadowy=2:shadowcolor=black@0.8` +
        `:x=(w-text_w)/2:y=h*0.50` +
        `:enable='between(t\\,${chunk.start}\\,${chunk.end})'`
      );
    })
    .join(',');
}

// ─── Combined Entry Point ─────────────────────────────────────────────────────

/**
 * Returns the complete FFmpeg -vf filter string combining the V6 brand
 * template and optional Whisper word captions.
 *
 * Usage in Railway worker (index.ts):
 *
 *   import { getCompleteFilterChain } from './brandTemplates';
 *
 *   const vf = getCompleteFilterChain(
 *     {
 *       hook,
 *       context: explanation || '',
 *       contentPillar: contentPillar || 'Breaking',
 *       videoDuration: duration,
 *       addOutro: true,
 *     },
 *     whisperCaptions  // WordCaption[] | undefined
 *   );
 *
 *   ffmpeg(inputPath)
 *     .seekInput(startTime)
 *     .duration(duration)
 *     .videoFilter(vf)
 *     ...
 */
export function getCompleteFilterChain(
  options: BrandTemplateOptions,
  captions?: WordCaption[]
): string {
  const brand    = buildBrandedVideoFilter(options);
  const capts    = captions && captions.length > 0 ? ',' + buildCaptionFilters(captions) : '';
  return brand + capts;
}


// ─── Content Pillars ───────────────────────────────────────────────────────────
// ─── YouTube Brand Template (V1) ─────────────────────────────────────────────
//
// Layout (1920x1080 landscape frame):
// ┌─────────────────────────────────────┐
// │  [HOOK BAR ~120px]                  │  ← Black bg, red border, yellow accent
// │  Badge(top-left) + Topic + Hook     │
// ├─────────────────────────────────────┤
// │                                     │
// │  [VIDEO ZONE ~800px]                │  ← Clip scaled to fill, letterboxed
// │                                     │
// ├─────────────────────────────────────┤
// │  [CONTEXT BAR ~160px]               │  ← Yellow stripe, explanation text
// └─────────────────────────────────────┘
//
// Canvas: 1920x1080
// Hook bar:    y=0     h=120
// Video zone:  y=120   h=800
// Context bar: y=920   h=160

export interface YouTubeBrandTemplateOptions {
  hook: string;
  context: string;
  contentPillar?: string;
  videoDuration?: number;
  addOutro?: boolean;
}

/**
 * Build the complete FFmpeg -vf filter chain for the YouTube V1 brand template.
 *
 * Input: any video clip (any aspect ratio)
 * Output: 1920x1080 landscape frame with brand overlays
 */
export function buildYouTubeBrandedVideoFilter(options: YouTubeBrandTemplateOptions): string {
  const {
    hook,
    context,
    contentPillar = 'Breaking',
    videoDuration = 45,
    addOutro = true,
  } = options;

  const hookText    = sanitize(wordWrap(hook, 60, 2));
  const contextText = sanitize(wordWrap(context, 80, 3));
  const pillarText  = sanitize(`⚡ ${contentPillar}`, 30);
  const outroStart  = Math.max(videoDuration - 6, videoDuration * 0.88);
  const contextEnd  = outroStart;

  const f: string[] = [];

  // ── 1. SCALE + PAD — clip into 1920x800 video zone ───────────────────────
  // Scale clip to fit within 1920x800, preserve aspect ratio
  f.push('scale=1920:800:force_original_aspect_ratio=decrease:flags=lanczos');
  // Pad to fill 1920x800 exactly (centers clip vertically within zone)
  f.push('pad=1920:800:(ow-iw)/2:(oh-ih)/2:black');
  // Pad full canvas to 1920x1080 — video zone sits at y=120
  f.push('pad=1920:1080:0:120:black');

  // ── 2. BADGE — blue circle, top-left ─────────────────────────────────────
  f.push('drawbox=x=20:y=16:w=86:h=86:color=0x1877F2@1.0:t=fill');
  f.push('drawbox=x=20:y=16:w=86:h=86:color=0xFFFFFF@0.85:t=2');
  f.push(`drawtext=text='W':fontsize=46:fontcolor=white:x=32:y=20:shadowx=1:shadowy=1:shadowcolor=black@0.5`);
  f.push(`drawtext=text='it':fontsize=18:fontcolor=white@0.68:x=66:y=44`);
  f.push(`drawtext=text='MATTERS':fontsize=11:fontcolor=white@0.62:x=23:y=82:letter_spacing=1`);

  // ── 3. HOOK BAR — top 120px ───────────────────────────────────────────────
  f.push('drawbox=x=0:y=0:w=iw:h=120:color=0x080808@0.95:t=fill');
  f.push('drawbox=x=0:y=116:w=iw:h=4:color=0xFF2D2D@1.0:t=fill');
  f.push('drawbox=x=0:y=120:w=iw:h=2:color=0xFFD400@0.55:t=fill');
  f.push(`drawtext=text='${pillarText}':fontsize=22:fontcolor=0xFF2D2D:x=120:y=22`);
  f.push(
    `drawtext=text='${hookText}'` +
    `:fontsize=38:fontcolor=white` +
    `:borderw=1:bordercolor=black@0.6` +
    `:shadowx=2:shadowy=2:shadowcolor=black@0.7` +
    `:x=120:y=52:line_spacing=5`
  );

  // ── 4. CONTEXT BAR — bottom 160px ─────────────────────────────────────────
  const ctxE = `enable='between(t\\,0\\,${contextEnd})'`;
  f.push(`drawbox=x=0:y=920:w=iw:h=3:color=0xFFD400@0.92:t=fill:${ctxE}`);
  f.push(`drawbox=x=0:y=923:w=iw:h=157:color=0x080808@0.95:t=fill:${ctxE}`);
  f.push(`drawtext=text='▸ WHY IT MATTERS':fontsize=20:fontcolor=0xFFD400:x=24:y=930:${ctxE}`);
  f.push(
    `drawtext=text='${contextText}'` +
    `:fontsize=32:fontcolor=white@0.92` +
    `:borderw=1:bordercolor=black@0.4` +
    `:x=24:y=958:line_spacing=8` +
    `:${ctxE}`
  );

  // ── 5. OUTRO — last 6 seconds ─────────────────────────────────────────────
  if (addOutro) {
    const outE = `enable='between(t\\,${outroStart}\\,${videoDuration})'`;
    f.push(`drawbox=x=0:y=920:w=iw:h=3:color=0xFFD400@1.0:t=fill:${outE}`);
    f.push(`drawbox=x=0:y=923:w=iw:h=157:color=0xFF2D2D@0.97:t=fill:${outE}`);
    for (let i = 0; i < 16; i++) {
      f.push(`drawbox=x=${i * 130 - 20}:y=923:w=2:h=157:color=black@0.06:t=fill:${outE}`);
    }
    f.push(`drawtext=text='FOLLOW FOR MORE':fontsize=52:fontcolor=white:x=(w-text_w)/2:y=938:${outE}`);
    f.push(`drawtext=text='↓  SUBSCRIBE  ↓':fontsize=34:fontcolor=0xFFD400:x=(w-text_w)/2:y=998:${outE}`);
  }

  return f.join(',');
}

/**
 * Build drawtext filters for Whisper word-level captions — YouTube version.
 * Positioned in the center of the video zone (y=120 to y=920).
 */
export function buildYouTubeCaptionFilters(captions: WordCaption[]): string {
  if (!captions || captions.length === 0) return '';

  const chunks: Array<{ text: string; start: number; end: number }> = [];
  for (let i = 0; i < captions.length; i += 4) {
    const group = captions.slice(i, i + 4);
    if (!group.length) continue;
    chunks.push({
      text: group.map(w => w.word).join(' '),
      start: group[0].start,
      end: group[group.length - 1].end,
    });
  }

  return chunks
    .map(chunk => {
      const t = sanitize(chunk.text, 60);
      return (
        `drawtext=text='${t}'` +
        `:fontsize=58:fontcolor=white` +
        `:borderw=3:bordercolor=black@0.92` +
        `:shadowx=2:shadowy=2:shadowcolor=black@0.8` +
        `:x=(w-text_w)/2:y=520` +
        `:enable='between(t\\,${chunk.start}\\,${chunk.end})'`
      );
    })
    .join(',');
}

/**
 * Returns the complete FFmpeg -vf filter string for YouTube videos,
 * combining the V1 YouTube brand template and optional Whisper captions.
 *
 * Usage in Railway worker:
 *
 *   import { getYouTubeCompleteFilterChain } from './brandTemplates';
 *
 *   const vf = getYouTubeCompleteFilterChain(
 *     {
 *       hook,
 *       context: explanation || '',
 *       contentPillar: contentPillar || 'Breaking',
 *       videoDuration: duration,
 *       addOutro: true,
 *     },
 *     whisperCaptions
 *   );
 */
export function getYouTubeCompleteFilterChain(
  options: YouTubeBrandTemplateOptions,
  captions?: WordCaption[]
): string {
  const brand = buildYouTubeBrandedVideoFilter(options);
  const capts = captions && captions.length > 0 ? ',' + buildYouTubeCaptionFilters(captions) : '';
  return brand + capts;
}