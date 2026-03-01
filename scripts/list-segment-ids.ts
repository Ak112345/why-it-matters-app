import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.NEXT_SUPABASE_SERVICE_ROLE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_URL or service role key environment variable.');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const PAGE_SIZE = Number(process.env.SEGMENT_LIST_PAGE_SIZE ?? 200);
const MAX_ROWS = Number(process.env.SEGMENT_LIST_MAX_ROWS ?? 1000);
const QUERY_TIMEOUT_MS = Number(process.env.SEGMENT_LIST_TIMEOUT_MS ?? 15000);
const SHOW_ALL = process.argv.includes('--all');

async function queryPage(from: number, to: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), QUERY_TIMEOUT_MS);

  try {
    return await supabase
      .from('clips_segmented')
      .select('id', { count: from === 0 ? 'exact' : undefined })
      .order('id', { ascending: true })
      .range(from, to)
      .abortSignal(controller.signal);
  } finally {
    clearTimeout(timeout);
  }
}

async function listSegmentIds() {
  let offset = 0;
  let totalSeen = 0;
  let totalCount: number | null = null;

  console.log(`Fetching segment ids in pages of ${PAGE_SIZE} (max ${MAX_ROWS} rows)...`);

  while (totalSeen < MAX_ROWS) {
    const pageFrom = offset;
    const pageTo = Math.min(offset + PAGE_SIZE - 1, offset + (MAX_ROWS - totalSeen) - 1);

    const { data, error, count } = await queryPage(pageFrom, pageTo);

    if (error) {
      const message =
        error.name === 'AbortError'
          ? `Query timed out after ${QUERY_TIMEOUT_MS}ms. Reduce page size or increase SEGMENT_LIST_TIMEOUT_MS.`
          : error.message;
      console.error('Error fetching segment ids:', message);
      return;
    }

    if (totalCount === null && typeof count === 'number') {
      totalCount = count;
      console.log(`Total rows in clips_segmented: ${totalCount}`);
    }

    if (!data || data.length === 0) {
      break;
    }

    totalSeen += data.length;

    if (SHOW_ALL) {
      for (const row of data) {
        console.log(row.id);
      }
    }

    if (data.length < PAGE_SIZE) {
      break;
    }

    offset += PAGE_SIZE;
  }

  if (totalSeen === 0) {
    console.log('No segment ids found in clips_segmented table.');
    return;
  }

  console.log(`Read ${totalSeen} segment id rows successfully.`);

  if (!SHOW_ALL) {
    console.log('Use --all to print every fetched id.');
  }

  if (totalCount !== null && totalSeen < totalCount) {
    console.log(`Stopped early at ${totalSeen}/${totalCount} rows to avoid timeout.`);
  }
}

listSegmentIds().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
