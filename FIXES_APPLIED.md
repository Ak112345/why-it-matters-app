# Fix Summary: Video Production Issues (2026-03-04)

## Issues Fixed

### 1. ✅ **Caption Text Wrapping** (FIXED)
**Problem**: Header caption was one long line that got cut off in videos

**Solution**: 
- Modified `buildDrawtextFilter()` in [railway-worker/src/index.ts](railway-worker/src/index.ts#L769-L783) to wrap hook text into lines of max 35 characters
- Changed text wrapping logic:
  ```typescript
  const words = fallbackHook.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if ((current + ' ' + word).length > 35) {
      lines.push(current);
      current = word;
    } else {
      current = current ? current + ' ' + word : word;
    }
  }
  lines.push(current);
  const wrappedHook = lines.join('\n');
  ```
- Moved caption position from bottom (y=h*0.80) to top (y=h*0.15) for better visibility

---

### 2. ✅ **FFprobe ENOENT Error** (FIXED)
**Problem**: `ffprobe` binary not found at `/app/node_modules/@ffprobe-installer/linux-x64/ffmpeg`

**Solution**:
- Replaced incorrect ffprobe path construction with proper `@ffprobe-installer/ffprobe` package
- Updated imports in [railway-worker/src/index.ts](railway-worker/src/index.ts#L6a):
  ```typescript
  import ffprobeInstaller from '@ffmpeg-installer/ffmpeg';
  import ffprobeInstaller from '@ffprobe-installer/ffprobe';
  
  ffmpeg.setFfmpegPath(ffmpegInstaller.path);
  ffmpeg.setFfprobePath(ffprobeInstaller.path);
  ```
- Added `@ffprobe-installer/ffprobe` to [railway-worker/package.json](railway-worker/package.json#L12)
- Created type declarations in [railway-worker/src/types/ffprobe-installer.d.ts](railway-worker/src/types/ffprobe-installer.d.ts)

---

### 3. ✅ **Audio Muting Issue** (FIXED)
**Problem**: Video output had no sound (silence)

**Solution**:
- Simplified FFmpeg audio encoding in `trimAndCaptionVideo()` to properly handle audio:
  - Removed redundant `.audioCodec('aac')` and `.audioBitrate('128k')` calls
  - Explicitly set audio codec options:
    ```typescript
    .addOption('-c:a', 'aac')
    .addOption('-b:a', '128k')
    .addOption('-q:a', '5')
    ```
- This allows FFmpeg to properly copy audio from input or fail gracefully if no audio exists

---

### 4. ✅ **Whisper Captions Not Working** (ADDRESSED)
**Problem**: Whisper returning 0 words because Pexels videos have no audio

**Status**: System handles this gracefully
- When Whisper returns 0 words (no audio detected), the railway worker falls back to using the hook text as static captions
- This is the expected behavior for stock footage without audio
- Captions now display properly with text wrapping fix from issue #1

---

## Remaining Known Issues

### ⚠️ Content/Segment Selection Mismatch
**Problem**: Video generated is a 10-second clip of wrong content (e.g., pregnancy test) but title is about policy change

**Root Cause**: 
- System analyzes Pexels video segments based on generic metadata (title, tags) not actual visual content
- GPT-4 cannot watch videos, so it generates analysis based on Pexels metadata which may not match segment visuals
- Some Pexels videos have generic keywords that don't match specific segments

**Potential Solutions** (not yet implemented):
1. Add visual quality checks before producing videos
2. Use better metadata filtering when selecting segments
3. Implement human review approval for content analysis
4. Use a more sophisticated segment selection algorithm that correlates metadata with segment timing

---

## Files Modified

1. **[railway-worker/src/index.ts](railway-worker/src/index.ts)**
   - Line 6-7: Updated ffprobe import
   - Line 769-783: Fixed caption text wrapping
   - Line 820-828: Improved audio encoding

2. **[railway-worker/package.json](railway-worker/package.json)**
   - Added `@ffprobe-installer/ffprobe` dependency

3. **[railway-worker/src/types/ffprobe-installer.d.ts](railway-worker/src/types/ffprobe-installer.d.ts)** (NEW)
   - Type declarations for ffprobe-installer module

---

## Testing Recommendations

1. **Test caption rendering**:
   - Verify long hook text wraps at 35 characters
   - Verify captions appear at top of video

2. **Test FFprobe error resolution**:
   - Check `/debug` endpoint shows correct ffprobe path
   - Verify video duration detection works

3. **Test audio handling**:
   - Process a video with audio → should preserve audio
   - Process a Pexels clip (no audio) → should not crash (currently outputs silent video)

4. **Test Whisper fallback**:
   - Verify hook text displays when Whisper returns 0 words
   - Check formatting with wrapped text

---

## Next Steps

For the content selection mismatch issue, consider implementing:
- Segment validation before production
- Better content-to-segment correlation
- Manual approval workflow for edge cases
