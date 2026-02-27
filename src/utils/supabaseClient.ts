import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || "";
  return createClient(url || "https://placeholder.supabase.co", key || "placeholder");
}

export const supabase = getSupabase();
export type TypedSupabaseClient = typeof supabase;
