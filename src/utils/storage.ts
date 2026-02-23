import { supabase } from './supabaseClient';
import fs from 'fs';

async function uploadToBucket(
  bucket: 'raw_clips' | 'segments' | 'final_videos',
  localPath: string,
  storagePath: string
) {
  const buffer = fs.readFileSync(localPath);
  const { error } = await supabase.storage
    .from(bucket)
    .upload(storagePath, buffer, { upsert: true });

  if (error) {
    throw new Error('Upload failed');
  }

  return storagePath;
}

export async function uploadRawClip(localPath: string, storagePath: string) {
  return uploadToBucket('raw_clips', localPath, storagePath);
}

export async function uploadSegment(localPath: string, storagePath: string) {
  return uploadToBucket('segments', localPath, storagePath);
}

export async function uploadFinalVideo(localPath: string, storagePath: string) {
  return uploadToBucket('final_videos', localPath, storagePath);
}

export async function uploadFile(
  bucket: 'raw_clips' | 'segmented_clips' | 'final_videos',
  storagePath: string,
  localPath: string
) {
  const buffer = fs.readFileSync(localPath);
  const { error } = await supabase.storage
    .from(bucket)
    .upload(storagePath, buffer, { upsert: true });

  if (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }

  return storagePath;
}

export async function downloadFromBucket(
  bucket: string,
  storagePath: string,
  localPath: string
) {
  const { data, error } = await supabase.storage.from(bucket).download(storagePath);
  if (error || !data) {
    throw new Error('Download failed');
  }

  const arrayBuffer = await data.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  fs.writeFileSync(localPath, buffer);
  return localPath;
}

export async function downloadFile(
  bucket: string,
  storagePath: string
) {
  const { data, error } = await supabase.storage.from(bucket).download(storagePath);
  if (error || !data) {
    console.error(`Download failed: bucket=${bucket}, path=${storagePath}, error=${error?.message}`);
    throw new Error(`Download failed: bucket=${bucket}, path=${storagePath}, error=${error?.message}`);
  }
  return data;
}

export function generateFilePath(type: string, extension: string = 'mp4'): string {
  return `${type}/${Date.now()}.${extension}`;
}
