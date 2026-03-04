export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function isAuthorized(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const cronSecret = process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET || '';

  if (!cronSecret) return process.env.NODE_ENV !== 'production';
  return bearerToken === cronSecret;
}

function parseStorageUri(storageUri: string): { bucket: string; path: string } | null {
  if (!storageUri.startsWith('storage://')) return null;
  const withoutPrefix = storageUri.replace('storage://', '');
  const slashIndex = withoutPrefix.indexOf('/');
  if (slashIndex <= 0) return null;

  const bucket = withoutPrefix.substring(0, slashIndex);
  const path = withoutPrefix.substring(slashIndex + 1);
  if (!bucket || !path) return null;

  return { bucket, path };
}

export async function GET(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const storageUri = request.nextUrl.searchParams.get('uri') || '';
    const expiresIn = Math.max(60, Math.min(86400, Number(request.nextUrl.searchParams.get('expiresIn') || '3600')));

    const parsed = parseStorageUri(storageUri);
    if (!parsed) {
      return NextResponse.json(
        { success: false, error: 'Invalid uri. Expected format: storage://bucket/path/to/file.mp4' },
        { status: 400 }
      );
    }

    const allowedBucket = process.env.POSTED_VIDEOS_BUCKET || 'videos_already_posted';
    if (parsed.bucket !== allowedBucket) {
      return NextResponse.json(
        { success: false, error: `Only ${allowedBucket} bucket is allowed` },
        { status: 403 }
      );
    }

    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { success: false, error: 'Missing Supabase credentials' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data, error } = await supabase.storage
      .from(parsed.bucket)
      .createSignedUrl(parsed.path, expiresIn);

    if (error || !data?.signedUrl) {
      return NextResponse.json(
        { success: false, error: error?.message || 'Could not generate signed URL' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      signedUrl: data.signedUrl,
      expiresIn,
      uri: storageUri,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
