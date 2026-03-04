import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as https from 'https';
import * as http from 'http';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const PEXELS_API_KEY = process.env.PEXELS_API_KEY || '';

if (!SUPABASE_URL || !SUPABASE_KEY || !PEXELS_API_KEY) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(dest);
    protocol.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        file.close(); fs.unlinkSync(dest);
        downloadFile(response.headers.location!, dest).then(resolve).catch(reject);
        return;
      }
      if (response.statusCode !== 200) { reject(new Error(`Download failed: ${response.statusCode}`)); return; }
      response.pipe(file);
      file.on('finish', () => file.close(() => resolve()));
    }).on('error', (err) => { fs.unlinkSync(dest); reject(err); });
  });
}

async function getPexelsDownloadUrl(sourceId: string): Promise<string | null> {
  const numericId = sourceId.replace(/^pexels_/, '');
  const res = await fetch(`https://api.pexels.com/videos/videos/${numericId}`, {
    headers: { Authorization: PEXELS_API_KEY },
  });
  if (!res.ok) return null;
  const data = await res.json() as any;
  const hdFile = data.video_files?.find((f: any) => f.quality === 'hd' && f.file_type === 'video/mp4')
    || data.video_files?.find((f: any) => f.file_type === 'video/mp4')
    || data.video_files?.[0];
  return hdFile?.link ?? null;
}

async function main() {
  console.log('Step 1: Deleting 10-second segments and analyses...');
  const { data: shortSegs } = await supabase.from('clips_segmented').select('id').eq('duration_seconds', 10);
  if (shortSegs && shortSegs.length > 0) {
    const ids = shortSegs.map((s: any) => s.id);
    await supabase.from('analysis').delete().in('segment_id', ids);
    await supabase.from('clips_segmented').delete().in('id', ids);
    console.log(`Deleted ${ids.length} short segments and their analyses`);
  } else {
    console.log('No 10-second segments found');
  }

  console.log('\nStep 2: Downloading Pexels clips to storage...');
  const { data: clips } = await supabase.from('clips_raw').select('id, source_id, duration_seconds').eq('source', 'pexels').eq('status', 'pending').limit(15);
  if (!clips || clips.length === 0) { console.log('No pending clips'); return; }

  for (const clip of clips) {
    const sourceId = clip.source_id as string;
    console.log(`\nProcessing ${sourceId}...`);
    const storagePath = `pexels-${sourceId.replace(/^pexels_/, '')}.mp4`;
    const downloadUrl = await getPexelsDownloadUrl(sourceId);
    if (!downloadUrl) { console.log('  Could not get URL, skipping'); continue; }
    const tmpPath = path.join(os.tmpdir(), `${sourceId}-${Date.now()}.mp4`);
    try {
      await downloadFile(downloadUrl, tmpPath);
      const sizeMB = (fs.statSync(tmpPath).size / 1024 / 1024).toFixed(1);
      console.log(`  Downloaded ${sizeMB}MB`);
      const fileBuffer = fs.readFileSync(tmpPath);
      const { error } = await supabase.storage.from('raw_clips').upload(storagePath, fileBuffer, { contentType: 'video/mp4', upsert: true });
      if (error) throw new Error(error.message);

      const totalDuration = (clip.duration_seconds as number) || 60;
      const segments = [];
      for (let start = 0; start + 30 <= totalDuration; start += 30) {
        segments.push({ raw_clip_id: clip.id, start_time: start, end_time: start + 30, duration_seconds: 30, status: 'pending', file_path: `${clip.id}/segment-${String(start).padStart(4,'0')}.mp4` });
      }
      if (segments.length === 0) segments.push({ raw_clip_id: clip.id, start_time: 0, end_time: totalDuration, duration_seconds: totalDuration, status: 'pending', file_path: `${clip.id}/segment-0000.mp4` });
      await supabase.from('clips_segmented').insert(segments);
      await supabase.from('clips_raw').update({ status: 'segmented', file_path: storagePath }).eq('id', clip.id);
      console.log(`  Uploaded + created ${segments.length} x 30s segments`);
    } catch (err: any) {
      console.error(`  Failed: ${err.message}`);
      await supabase.from('clips_raw').update({ status: 'error', error_message: err.message }).eq('id', clip.id);
    } finally {
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    }
  }
  console.log('\nDone!');
}

main().catch(console.error);
