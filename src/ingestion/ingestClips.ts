import { supabase } from '../utils/supabaseClient.ts';
import { ENV } from '../utils/env.ts';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { uploadRawClip } from '../utils/storage.ts';
import { fetchPexelsClips } from './fetchSources/pexels.ts';
import { fetchPixabayClips } from './fetchSources/pixabay.ts';

export async function ingestClips(query: string) {
  let pexels: any[] = [];
  let pixabay: any[] = [];

  // Try Pexels
  if (ENV.PEXELS_API_KEY) {
    try {
      pexels = await fetchPexelsClips(query);
      console.log(`✓ Fetched ${pexels.length} clips from Pexels`);
    } catch (error) {
      console.error('Pexels fetch failed:', error instanceof Error ? error.message : error);
    }
  }

  // Try Pixabay
  if (ENV.PIXABAY_USERNAME) {
    try {
      pixabay = await fetchPixabayClips(query);
      console.log(`✓ Fetched ${pixabay.length} clips from Pixabay`);
    } catch (error) {
      console.error('Pixabay fetch failed:', error instanceof Error ? error.message : error);
    }
  }

  const allClips = [...pexels, ...pixabay];
  
  if (allClips.length === 0) {
    throw new Error('No clips were fetched from any source');
  }

  let inserted = 0;

  for (const clip of allClips) {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vce-ingest-'));
    const localPath = path.join(tmpDir, 'raw.mp4');

    try {
      const response = await fetch(clip.download_url);
      if (!response.ok) {
        throw new Error(`Failed to download clip: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      fs.writeFileSync(localPath, buffer);

      const safeId = clip.source_id || String(Date.now());
      const filename = `${clip.source}-${safeId}.mp4`;
      const storagePath = filename;

      await uploadRawClip(localPath, storagePath);

      const { error } = await supabase.from('clips_raw').insert({
        source: clip.source,
        source_id: clip.source_id || null,
        file_path: storagePath,
        duration_seconds: clip.duration || null,
        status: 'pending',
        created_at: new Date().toISOString(),
      });

      if (!error) {
        inserted += 1;
      }
    } catch (error) {
      console.error('Failed to ingest clip:', error);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  return { inserted };
}
