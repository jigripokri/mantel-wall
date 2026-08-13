import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, HAS_SUPABASE } from "./supabase";

export type SessionState = {
  session: Session | null;
  email: string | null;
  /** Still determining whether a stored session exists. Render nothing decisive
   *  while true — flashing a sign-in screen at a wall that is about to restore
   *  its session looks like a fault. */
  loading: boolean;
  /** No auth configured at all (mock mode). Everything stays open. */
  open: boolean;
};

/**
 * The session the whole app hangs off.
 *
 * `/tv` is a kiosk: it signs in once and must stay signed in for months without
 * anyone touching it. `persistSession` + `autoRefreshToken` (see supabase.ts)
 * keep the refresh token rotating in localStorage, so the Pi survives reboots
 * as long as its browser profile does.
 *
 * In mock mode (no Supabase configured) this reports `open: true` and nothing
 * is gated — CLAUDE.md requires the UI stay reviewable with no cloud account.
 */
export function useSession(): SessionState {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(HAS_SUPABASE);

  useEffect(() => {
    if (!HAS_SUPABASE || !supabase) return;
    const client = supabase;

    let cancelled = false;
    client.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data: sub } = client.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return {
    session,
    email: session?.user?.email ?? null,
    loading,
    open: !HAS_SUPABASE,
  };
}
