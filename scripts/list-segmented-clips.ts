// ...existing code...
// ...existing code...

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.NEXT_SUPABASE_SERVICE_ROLE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_URL or service role key environment variable.');
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function listFiles() {
  const { data, error } = await supabase.storage.from('segmented_clips').list('', { limit: 1000 });
  if (error) {
    console.error('Error listing files:', error.message);
    return;
  }
  if (!data || data.length === 0) {
    console.log('No files found in segmented_clips bucket.');
    return;
  }
  console.log('Files in segmented_clips bucket:');
  for (const file of data) {
    console.log(file.name);
  }
}

listFiles();