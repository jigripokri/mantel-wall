import { useEffect, useState } from "react";
import { supabase, HAS_SUPABASE } from "./supabase";

/** Calendar syncs every 15 min. Three missed cycles before we say anything, so
 *  one transient failure doesn't put a notice on the wall. */
const STALE_AFTER_MS = 45 * 60 * 1000;
const CHECK_EVERY_MS = 5 * 60 * 1000;

export type Freshness = {
  /** True when the newest successful sync is older than STALE_AFTER_MS, or when
   *  no source has ever succeeded. */
  stale: boolean;
  /** Minutes since the most recent successful sync, null if never. */
  minutesSinceSuccess: number | null;
};

/**
 * Answers the question the wall cannot otherwise ask: is what I'm showing still
 * true?
 *
 * Every failure in this system presents identically — cron unscheduled, feed
 * revoked, function throwing, Supabase unreachable — as a wall that keeps
 * displaying the last thing it knew. Without this, a stalled pipeline is
 * indistinguishable from a quiet week, and the wall is most wrong exactly when
 * it looks most normal.
 *
 * Reads `sync_health`, which the Edge Functions stamp on every run whether or
 * not anything changed. It deliberately does NOT use `entries.updated_at`: the
 * sync is read-diff-write, so a genuinely quiet week writes nothing at all.
 */
export function useFreshness(enabled: boolean): Freshness {
  const [state, setState] = useState<Freshness>({ stale: false, minutesSinceSuccess: null });

  useEffect(() => {
    if (!HAS_SUPABASE || !supabase || !enabled) return;
    const client = supabase;
    let cancelled = false;

    const check = async () => {
      const { data, error } = await client.from("sync_health").select("source, last_success_at");
      if (cancelled) return;
      if (error) {
        // Can't tell — say nothing rather than cry wolf on a transient blip.
        console.warn("[freshness] could not read sync_health", error.message);
        return;
      }

      const rows = data ?? [];
      if (rows.length === 0) return; // nothing registered; nothing to claim

      // The OLDEST source decides, not the newest. Taking the newest would let
      // a healthy weather sync mask a dead calendar — which is the exact
      // failure this exists to surface. A source that has never succeeded is
      // maximally stale, not "no data yet".
      let worstAge = -1;
      let everSucceeded = false;
      for (const r of rows) {
        const t = r.last_success_at ? new Date(r.last_success_at as string).getTime() : null;
        if (t === null || !Number.isFinite(t)) {
          setState({ stale: true, minutesSinceSuccess: null });
          return;
        }
        everSucceeded = true;
        worstAge = Math.max(worstAge, Date.now() - t);
      }

      setState({
        stale: everSucceeded && worstAge > STALE_AFTER_MS,
        minutesSinceSuccess: Math.max(0, Math.round(worstAge / 60000)),
      });
    };

    check();
    const timer = setInterval(check, CHECK_EVERY_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [enabled]);

  return state;
}

/** "2 hours ago" — coarse on purpose; the wall should suggest doubt, not
 *  invite arithmetic from across a room. */
export function describeAge(minutes: number | null): string {
  if (minutes === null) return "not syncing";
  if (minutes < 90) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 36) return `${hours} hr ago`;
  return `${Math.round(hours / 24)} days ago`;
}
