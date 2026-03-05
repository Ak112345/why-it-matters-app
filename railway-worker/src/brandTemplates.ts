/**
 * brandTemplates.ts
 * "This Is Why It Matters" brand templates
 *
 * Includes:
 * - Vertical template (1080x1920)
 * - YouTube / landscape template (1920x1080)
 * - Optional word-level caption overlays
 */

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

export interface YouTubeBrandTemplateOptions {
  hook: string;
  context: string;
  contentPillar?: string;
  videoDuration?: number;
  addOutro?: boolean;
}

// Optional font paths for Railway / Linux containers
const FONT_BOLD =
  process.env.WIM_FONT_BOLD ||
  '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';

const FONT_REGULAR =
  process.env.WIM_FONT_REGULAR ||
  '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';

function escapeFontPath(fontPath: string): string {
  return fontPath
    .replace(/\\/g, '/')
    .replace(/:/g, '\\:')
    .replace(/'/g, "\\'");
}

function fontArg(fontPath: string): string {
  return `fontfile='${escapeFontPath(fontPath)}'`;
}

/**
 * Escapes text for FFmpeg drawtext, preserving line breaks.
 */
function sanitize(text: string, maxLen = 120): string {
  return text
    .replace(/\r/g, '')
    .replace(/\t/g, ' ')
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
 * Converts text into drawtext-safe text with escaped newlines.
 */
function toDrawtextText(text: string, maxLen = 120): string {
  return sanitize(text, maxLen).replace(/\n/g, '\\n');
}

/**
 * Simple word wrap by character count.
 */
function wordWrap(text: string, maxChars = 32, maxLines = 3): string {
  const words = text.split(' ').filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars) {
      if (current) lines.push(current);
      current = word;
      if (lines.length >= maxLines) break;
    } else {
      current = next;
    }
  }

  if (current && lines.length < maxLines) {
    lines.push(current);
  }

  return lines.slice(0, maxLines).join('\n');
}

/**
 * Groups captions into chunks.
 */
function chunkCaptions(
  captions: WordCaption[],
  size: number
): Array<{ text: string; start: number; end: number }> {
  const chunks: Array<{ text: string; start: number; end: number }> = [];

  for (let i = 0; i < captions.length; i += size) {
    const group = captions
      .slice(i, i + size)
      .filter(
        c =>
          c &&
          typeof c.word === 'string' &&
          c.word.trim() &&
          Number.isFinite(c.start) &&
          Number.isFinite(c.end) &&
          c.end > c.start
      );

    if (!group.length) continue;

    chunks.push({
      text: group.map(w => w.word.trim()).join(' '),
      start: group[0].start,
      end: group[group.length - 1].end,
    });
  }

  return chunks;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Vertical template (1080x1920)                                            */
/* ────────────────────────────────────────────────────────────────────────── */

export function buildBrandedVideoFilter(options: BrandTemplateOptions): string {
  const {
    hook,
    context,
    contentPillar = 'Breaking',
    videoDuration = 30,
    addOutro = true,
  } = options;

  const hookText = toDrawtextText(wordWrap(hook, 34, 2), 140);
  const contextText = toDrawtextText(wordWrap(context, 36, 4), 220);
  const pillarText = toDrawtextText(`⚡ ${contentPillar}`, 40);

  const outroStart = Math.max(videoDuration - 4, videoDuration * 0.87);
  const contextEnd = outroStart;

  const f: string[] = [];

  // 1) Scale and pad to vertical canvas
  f.push('scale=1080:608:force_original_aspect_ratio=decrease:flags=lanczos');
  f.push('pad=1080:1920:(ow-iw)/2:656:black');

  // 2) Badge
  f.push('drawbox=x=18:y=18:w=82:h=82:color=0x1877F2@1.0:t=fill');
  f.push('drawbox=x=18:y=18:w=82:h=82:color=0xFFFFFF@0.85:t=2');
  f.push(
    `drawtext=${fontArg(FONT_BOLD)}:text='W':fontsize=44:fontcolor=white:x=30:y=22:shadowx=1:shadowy=1:shadowcolor=black@0.5`
  );
  f.push(
    `drawtext=${fontArg(FONT_REGULAR)}:text='it':fontsize=17:fontcolor=white@0.68:x=63:y=44`
  );
  f.push(
    `drawtext=${fontArg(FONT_BOLD)}:text='MATTERS':fontsize=11:fontcolor=white@0.62:x=21:y=80`
  );

  // 3) Hook bar
  f.push('drawbox=x=0:y=0:w=iw:h=124:color=0x080808@0.94:t=fill');
  f.push('drawbox=x=0:y=120:w=iw:h=4:color=0xFF2D2D@1.0:t=fill');
  f.push('drawbox=x=0:y=124:w=iw:h=2:color=0xFFD400@0.55:t=fill');

  f.push(
    `drawtext=${fontArg(FONT_BOLD)}:text='${pillarText}':fontsize=22:fontcolor=0xFF2D2D:x=112:y=26`
  );

  f.push(
    `drawtext=${fontArg(FONT_BOLD)}:text='${hookText}'` +
      `:fontsize=34:fontcolor=white` +
      `:borderw=1:bordercolor=black@0.6` +
      `:shadowx=2:shadowy=2:shadowcolor=black@0.7` +
      `:x=112:y=54:line_spacing=5`
  );

  // 4) Context bar
  const ctxE = `enable='between(t\\,0\\,${contextEnd})'`;

  f.push(`drawbox=x=0:y=ih-204:w=iw:h=3:color=0xFFD400@0.92:t=fill:${ctxE}`);
  f.push(`drawbox=x=0:y=ih-201:w=iw:h=201:color=0x080808@0.94:t=fill:${ctxE}`);

  f.push(
    `drawtext=${fontArg(FONT_BOLD)}:text='▸ WHY IT MATTERS':fontsize=20:fontcolor=0xFFD400:x=18:y=ih-192:${ctxE}`
  );

  f.push(
    `drawtext=${fontArg(FONT_REGULAR)}:text='${contextText}'` +
      `:fontsize=30:fontcolor=white@0.92` +
      `:borderw=1:bordercolor=black@0.4` +
      `:x=18:y=ih-166:line_spacing=8` +
      `:${ctxE}`
  );

  // 5) Outro
  if (addOutro) {
    const outE = `enable='between(t\\,${outroStart}\\,${videoDuration})'`;

    f.push(`drawbox=x=0:y=ih-134:w=iw:h=3:color=0xFFD400@1.0:t=fill:${outE}`);
    f.push(`drawbox=x=0:y=ih-131:w=iw:h=131:color=0xFF2D2D@0.97:t=fill:${outE}`);

    for (let i = 0; i < 9; i++) {
      f.push(
        `drawbox=x=${i * 130 - 20}:y=ih-131:w=2:h=131:color=black@0.06:t=fill:${outE}`
      );
    }

    f.push(
      `drawtext=${fontArg(FONT_BOLD)}:text='FOLLOW FOR MORE':fontsize=46:fontcolor=white:x=(w-text_w)/2:y=ih-112:${outE}`
    );
    f.push(
      `drawtext=${fontArg(FONT_BOLD)}:text='↓  SUBSCRIBE  ↓':fontsize=30:fontcolor=0xFFD400:x=(w-text_w)/2:y=ih-58:${outE}`
    );
  }

  return f.join(',');
}

export function buildCaptionFilters(captions: WordCaption[]): string {
  if (!captions || captions.length === 0) return '';

  return chunkCaptions(captions, 3)
    .map(chunk => {
      const t = toDrawtextText(chunk.text, 60);

      return (
        `drawtext=${fontArg(FONT_BOLD)}:text='${t}'` +
        `:fontsize=54:fontcolor=white` +
        `:borderw=3:bordercolor=black@0.92` +
        `:shadowx=2:shadowy=2:shadowcolor=black@0.8` +
        `:x=(w-text_w)/2:y=h*0.50` +
        `:enable='between(t\\,${chunk.start}\\,${chunk.end})'`
      );
    })
    .join(',');
}

export function getCompleteFilterChain(
  options: BrandTemplateOptions,
  captions?: WordCaption[]
): string {
  const brand = buildBrandedVideoFilter(options);
  const capts =
    captions && captions.length > 0 ? ',' + buildCaptionFilters(captions) : '';
  return brand + capts;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* YouTube / landscape template (1920x1080)                                  */
/* ────────────────────────────────────────────────────────────────────────── */

export function buildYouTubeBrandedVideoFilter(
  options: YouTubeBrandTemplateOptions
): string {
  const {
    hook,
    context,
    contentPillar = 'Breaking',
    videoDuration = 45,
    addOutro = true,
  } = options;

  const hookText = toDrawtextText(wordWrap(hook, 60, 2), 180);
  const contextText = toDrawtextText(wordWrap(context, 80, 3), 260);
  const pillarText = toDrawtextText(`⚡ ${contentPillar}`, 40);

  const outroStart = Math.max(videoDuration - 6, videoDuration * 0.88);
  const contextEnd = outroStart;

  const f: string[] = [];

  // 1) Scale and pad into 1920x1080 canvas
  f.push('scale=1920:800:force_original_aspect_ratio=decrease:flags=lanczos');
  f.push('pad=1920:800:(ow-iw)/2:(oh-ih)/2:black');
  f.push('pad=1920:1080:(ow-iw)/2:120:black');

  // 2) Badge
  f.push('drawbox=x=20:y=16:w=86:h=86:color=0x1877F2@1.0:t=fill');
  f.push('drawbox=x=20:y=16:w=86:h=86:color=0xFFFFFF@0.85:t=2');
  f.push(
    `drawtext=${fontArg(FONT_BOLD)}:text='W':fontsize=46:fontcolor=white:x=32:y=20:shadowx=1:shadowy=1:shadowcolor=black@0.5`
  );
  f.push(
    `drawtext=${fontArg(FONT_REGULAR)}:text='it':fontsize=18:fontcolor=white@0.68:x=66:y=44`
  );
  f.push(
    `drawtext=${fontArg(FONT_BOLD)}:text='MATTERS':fontsize=11:fontcolor=white@0.62:x=23:y=82`
  );

  // 3) Hook bar
  f.push('drawbox=x=0:y=0:w=iw:h=120:color=0x080808@0.95:t=fill');
  f.push('drawbox=x=0:y=116:w=iw:h=4:color=0xFF2D2D@1.0:t=fill');
  f.push('drawbox=x=0:y=120:w=iw:h=2:color=0xFFD400@0.55:t=fill');

  f.push(
    `drawtext=${fontArg(FONT_BOLD)}:text='${pillarText}':fontsize=22:fontcolor=0xFF2D2D:x=120:y=22`
  );

  f.push(
    `drawtext=${fontArg(FONT_BOLD)}:text='${hookText}'` +
      `:fontsize=38:fontcolor=white` +
      `:borderw=1:bordercolor=black@0.6` +
      `:shadowx=2:shadowy=2:shadowcolor=black@0.7` +
      `:x=120:y=52:line_spacing=5`
  );

  // 4) Context bar
  const ctxE = `enable='between(t\\,0\\,${contextEnd})'`;

  f.push(`drawbox=x=0:y=920:w=iw:h=3:color=0xFFD400@0.92:t=fill:${ctxE}`);
  f.push(`drawbox=x=0:y=923:w=iw:h=157:color=0x080808@0.95:t=fill:${ctxE}`);

  f.push(
    `drawtext=${fontArg(FONT_BOLD)}:text='▸ WHY IT MATTERS':fontsize=20:fontcolor=0xFFD400:x=24:y=930:${ctxE}`
  );

  f.push(
    `drawtext=${fontArg(FONT_REGULAR)}:text='${contextText}'` +
      `:fontsize=32:fontcolor=white@0.92` +
      `:borderw=1:bordercolor=black@0.4` +
      `:x=24:y=958:line_spacing=8` +
      `:${ctxE}`
  );

  // 5) Outro
  if (addOutro) {
    const outE = `enable='between(t\\,${outroStart}\\,${videoDuration})'`;

    f.push(`drawbox=x=0:y=920:w=iw:h=3:color=0xFFD400@1.0:t=fill:${outE}`);
    f.push(`drawbox=x=0:y=923:w=iw:h=157:color=0xFF2D2D@0.97:t=fill:${outE}`);

    for (let i = 0; i < 16; i++) {
      f.push(
        `drawbox=x=${i * 130 - 20}:y=923:w=2:h=157:color=black@0.06:t=fill:${outE}`
      );
    }

    f.push(
      `drawtext=${fontArg(FONT_BOLD)}:text='FOLLOW FOR MORE':fontsize=52:fontcolor=white:x=(w-text_w)/2:y=938:${outE}`
    );
    f.push(
      `drawtext=${fontArg(FONT_BOLD)}:text='↓  SUBSCRIBE  ↓':fontsize=34:fontcolor=0xFFD400:x=(w-text_w)/2:y=998:${outE}`
    );
  }

  return f.join(',');
}

export function buildYouTubeCaptionFilters(captions: WordCaption[]): string {
  if (!captions || captions.length === 0) return '';

  return chunkCaptions(captions, 4)
    .map(chunk => {
      const t = toDrawtextText(chunk.text, 70);

      return (
        `drawtext=${fontArg(FONT_BOLD)}:text='${t}'` +
        `:fontsize=58:fontcolor=white` +
        `:borderw=3:bordercolor=black@0.92` +
        `:shadowx=2:shadowy=2:shadowcolor=black@0.8` +
        `:x=(w-text_w)/2:y=520` +
        `:enable='between(t\\,${chunk.start}\\,${chunk.end})'`
      );
    })
    .join(',');
}

export function getYouTubeCompleteFilterChain(
  options: YouTubeBrandTemplateOptions,
  captions?: WordCaption[]
): string {
  const brand = buildYouTubeBrandedVideoFilter(options);
  const capts =
    captions && captions.length > 0
      ? ',' + buildYouTubeCaptionFilters(captions)
      : '';
  return brand + capts;
}
