import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.NEXT_SUPABASE_SERVICE_ROLE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_URL or service role key environment variable.');
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function listSegmentIds() {
  const { data, error } = await supabase.from('clips_segmented').select('id');
  if (error) {
    console.error('Error fetching segment ids:', error.message);
    return;
  }
  if (!data || data.length === 0) {
    console.log('No segment ids found in clips_segmented table.');
    return;
  }
  console.log('Segment ids from clips_segmented table:');
  for (const row of data) {
    console.log(row.id);
  }
}

listSegmentIds();