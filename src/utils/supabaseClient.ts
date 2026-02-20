/**
 * Typed Supabase client for server-side operations
 */

import { createClient } from '@supabase/supabase-js';
import { ENV } from './env';
import type { Database } from '../types/database.ts';

/**
 * Server-side Supabase client with service role key
 * Use this for API routes and server-side operations
 */
export const supabase = createClient<Database>(
  ENV.SUPABASE_URL,
  ENV.SUPABASE_SERVICE_ROLE_KEY
);

export type TypedSupabaseClient = typeof supabase;
