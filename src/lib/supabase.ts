import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * True when the app is wired to a real Supabase project. When false, the wall
 * runs off mock data (src/lib/mockData.ts) so the whole UI is buildable and
 * reviewable before any cloud account exists. See CLAUDE.md.
 */
export const HAS_SUPABASE = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = HAS_SUPABASE
  ? createClient(url!, anonKey!, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : null;
