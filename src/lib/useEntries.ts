import { useEffect, useState } from "react";
import { supabase, HAS_SUPABASE } from "./supabase";
import { useSession } from "./useSession";
import { mockEntries } from "./mockData";
import type { Entry } from "./types";

/** Safety-net refetch. Long enough to be negligible load, short enough that a
 *  wall which missed a Realtime message rights itself well inside an hour. */
const REFETCH_EVERY_MS = 10 * 60 * 1000;

/**
 * A local stand-in for the photo layer. Dev only.
 *
 * With no photo queued the wall falls back to its solid surface, which makes the
 * photo-led designs impossible to judge in the preview panel. Point
 * `VITE_DEV_PHOTO_URL` at file(s) in `public/dev-photos/` (gitignored) to iterate
 * against real images. It is comma-separated so the board's P6a mantelpiece can
 * be reviewed as a full trio; each item is `url` or `url|caption`, and the first
 * is treated as newest — the board's hero frame, the one that carries a caption.
 *
 * These are synthetic *entries* rather than a special case inside `usePhotos`, so
 * the whole real path still runs — signing is skipped (they carry a direct url),
 * but ordering, framing, and the photo/solid switch behave exactly as in prod.
 *
 * `import.meta.env.DEV` is statically false in a production build, so this and
 * its caller are dead-code-eliminated from the bundle the Pi loads.
 */
function devPhotoEntries(): Entry[] {
  if (!import.meta.env.DEV) return [];
  const raw = import.meta.env.VITE_DEV_PHOTO_URL as string | undefined;
  if (!raw) return [];
  const items = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const base = Date.now();
  return items.map((item, i) => {
    const [url, caption] = item.split("|").map((s) => s.trim());
    // Stagger created_at so the first listed url sorts newest (the hero frame).
    const iso = new Date(base - i * 1000).toISOString();
    return {
      id: `dev-photo-${i}`,
      type: "photo",
      source: "dev",
      created_by: null,
      created_at: iso,
      updated_at: iso,
      starts_at: null,
      ends_at: null,
      due_at: null,
      expires_at: null,
      status: "active",
      color: null,
      external_id: null,
      pinned: false,
      sort_order: 0,
      payload: caption ? { url, caption } : { url },
      media_key: null,
    } as Entry;
  });
}

function withDevPhoto(entries: Entry[]): Entry[] {
  return [...entries, ...devPhotoEntries()];
}

/**
 * The single read path for the wall and the phone. With Supabase configured it
 * does an initial fetch then subscribes to Realtime — any change to `entries`
 * repaints with no polling. Without Supabase it serves deterministic mock data.
 */
export function useEntries(): {
  entries: Entry[];
  loading: boolean;
  live: boolean;
  /** False when Supabase is configured but nobody is signed in. Callers should
   *  render the gate rather than an empty wall — RLS returns zero rows to an
   *  anonymous reader, which is indistinguishable from "nothing on today". */
  authed: boolean;
} {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const { session, loading: sessionLoading, open } = useSession();
  const authed = open || Boolean(session);

  useEffect(() => {
    if (!HAS_SUPABASE || !supabase) {
      setEntries(withDevPhoto(mockEntries(new Date())));
      setLoading(false);
      return;
    }

    // Wait for the session to resolve. Querying first would return zero rows
    // under RLS and paint an empty wall a moment before the real one arrives.
    if (sessionLoading) return;
    if (!session) {
      setEntries([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const client = supabase;

    const fetchAll = () =>
      client
        .from("entries")
        .select("*")
        .neq("status", "archived")
        .order("starts_at", { ascending: true })
        .then(({ data, error }) => {
          if (cancelled) return;
          if (error) {
            console.error("[entries] fetch failed", error);
            return; // keep whatever is on screen rather than blanking the wall
          }
          setEntries(withDevPhoto((data as Entry[]) ?? []));
          setLoading(false);
        });

    fetchAll();

    const channel = client
      .channel("entries-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "entries" },
        (payload) => {
          setEntries((prev) => applyChange(prev, payload as unknown as ChangePayload));
        },
      )
      .subscribe();

    // Realtime is the fast path, not the only path. The wall is a kiosk that
    // may run for months: a dropped socket, a suspended tab, or a missed
    // message would otherwise leave it stale forever with no way back. A slow
    // refetch makes it self-healing — it converges even if every push is lost.
    const resync = setInterval(fetchAll, REFETCH_EVERY_MS);

    return () => {
      cancelled = true;
      clearInterval(resync);
      client.removeChannel(channel);
    };
    // Re-runs when the session arrives or is replaced, which also re-subscribes
    // Realtime under the new token — the channel is RLS-scoped, so a stale
    // token would silently stop delivering changes.
  }, [session, sessionLoading]);

  return { entries, loading: loading || sessionLoading, live: HAS_SUPABASE, authed };
}

type ChangePayload = {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: Entry | Record<string, never>;
  old: { id?: string } | Record<string, never>;
};

function applyChange(prev: Entry[], payload: ChangePayload): Entry[] {
  const { eventType } = payload;
  if (eventType === "DELETE") {
    return prev.filter((e) => e.id !== payload.old.id);
  }
  const row = payload.new as Entry;
  if (row.status === "archived") return prev.filter((e) => e.id !== row.id);
  const idx = prev.findIndex((e) => e.id === row.id);
  if (idx === -1) return [...prev, row];
  const next = prev.slice();
  next[idx] = row;
  return next;
}
