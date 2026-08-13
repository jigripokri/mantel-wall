import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./supabase";
import type { Entry } from "./types";

const BUCKET = "photos";
const SIGN_TTL_SECONDS = 60 * 60 * 6; // 6h
const RESIGN_EVERY_MS = 1000 * 60 * 60 * 4; // 4h — two hours of slack
const ROTATE_EVERY_MS = 1000 * 60 * 60; // one frame changes every hour — décor, not a slideshow

export type Photo = { url: string; caption: string | null };

/**
 * Resolves the family's photo layer and drifts it over time: one frame changes
 * about once an hour, so the wall works through the whole collection instead of
 * freezing on the newest — the design's "rotation over time" spec, at a calmer,
 * décor cadence (one at a time, never two at once, never the same slot twice
 * running). A full three-frame turnover takes ~3 hours.
 *
 * The Side veil layout uses only the first photo (a full-bleed background); the
 * Oat & moss board leans up to three as a mantelpiece (P6a) and cross-fades the
 * one that rotates. Each shown photo is resolved to a displayable URL —
 * `payload.url` first (a plain URL or local asset, no Storage), otherwise the
 * private `media_key` is signed — and cached by id, so an unchanged frame keeps
 * the exact same url and neither reloads nor dissolves; only the rotated one does.
 *
 * Rotation state is in-component (an interval), so a refresh restarts it from the
 * newest — fine for a kiosk that rarely reloads, and the selection helpers below
 * are pure and tested.
 */
type Spec = { id: string; direct?: string; key: string | null; caption: string | null };

function activeSpecs(entries: Entry[]): Spec[] {
  return entries
    .filter((e) => e.type === "photo" && e.status === "active")
    // Newest first — the initial fill leads with the newest, then drifts.
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .map((e) => ({
      id: (e.payload as { url?: string }).url ?? e.media_key ?? e.id,
      direct: (e.payload as { url?: string }).url,
      key: e.media_key,
      caption: (e.payload as { caption?: string }).caption ?? null,
    }));
}

/**
 * Reconcile the shown-photo ids as the library changes: drop any that no longer
 * exist, keep the rest in place, and fill up to `limit` from the newest not yet
 * shown. `fresh` ids — uploads that just arrived — are admitted immediately at
 * the front (the hero frame), pushing the same number of old photos out from the
 * front, so the surviving frames keep both their photo and their position and
 * the upload reads as a single dissolve, not a reshuffle. Pure.
 */
export function reconcileShown(
  prev: string[],
  orderedIds: string[],
  limit: number,
  fresh: string[] = [],
): string[] {
  const exists = new Set(orderedIds);
  const target = Math.min(limit, orderedIds.length);
  // Newest-first (orderedIds order), never one already on screen.
  const freshTake = orderedIds
    .filter((id) => fresh.includes(id) && !prev.includes(id))
    .slice(0, target);
  const kept = prev.filter((id) => exists.has(id) && !freshTake.includes(id));
  const room = target - freshTake.length;
  const dropped = Math.max(0, kept.length - room);
  let next = [...freshTake, ...kept.slice(dropped)];
  if (next.length < target) {
    const shown = new Set(next);
    next = [...next, ...orderedIds.filter((id) => !shown.has(id)).slice(0, target - next.length)];
  }
  return next;
}

/**
 * Rotate one slot: replace `shown[frame]` with the next id (from `cursor`) that
 * isn't already on screen, marching through `orderedIds` so every photo gets time
 * and none is ever shown in two frames at once. Pure; returns the next cursor.
 */
export function rotateSlot(
  shown: string[],
  orderedIds: string[],
  frame: number,
  cursor: number,
): { shown: string[]; cursor: number } {
  const n = orderedIds.length;
  if (n <= shown.length) return { shown, cursor }; // nothing off-screen to bring in
  const onScreen = new Set(shown);
  let c = ((cursor % n) + n) % n;
  for (let guard = 0; guard < n; guard++) {
    const id = orderedIds[c];
    if (!onScreen.has(id)) {
      const next = shown.slice();
      next[frame] = id;
      return { shown: next, cursor: c + 1 };
    }
    c = (c + 1) % n;
  }
  return { shown, cursor };
}

const sameIds = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

async function resolveSpec(
  spec: Spec | undefined,
  cache: Map<string, { photo: Photo; at: number }>,
): Promise<Photo | null> {
  if (!spec) return null;
  if (spec.direct) return { url: spec.direct, caption: spec.caption };
  if (!spec.key || !supabase) return null;
  const hit = cache.get(spec.id);
  if (hit && Date.now() - hit.at < RESIGN_EVERY_MS) return hit.photo; // stable url — no churn
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(spec.key, SIGN_TTL_SECONDS);
  if (error || !data) {
    console.warn("[usePhotos] could not sign", spec.key, error?.message);
    return hit?.photo ?? null; // keep a possibly-stale url rather than blanking the frame
  }
  const photo = { url: data.signedUrl, caption: spec.caption };
  cache.set(spec.id, { photo, at: Date.now() });
  return photo;
}

/**
 * An order-INDEPENDENT signature of the active photo set (id + created_at +
 * caption). Photos share a null `starts_at`, so the entries refetch can hand
 * them back in a different order each poll; if that reorder looked like a change
 * it would restart the rotation timer every poll, so the hourly rotation would
 * never fire and new uploads would never drift in. Sorting keys it to the *set*,
 * not the order.
 */
export function photoSetKey(entries: Entry[]): string {
  return entries
    .filter((e) => e.type === "photo" && e.status === "active")
    .map((e) => `${e.id}:${e.created_at}:${(e.payload as { caption?: string }).caption ?? ""}`)
    .sort()
    .join("|");
}

export function usePhotos(entries: Entry[], limit = 3): Photo[] {
  // Memoised on the photo *set*, not its order, so a mere refetch reorder never
  // restarts the rotation timer below.
  const signature = photoSetKey(entries);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const specs = useMemo(() => activeSpecs(entries), [signature]);
  const orderedIds = useMemo(() => specs.map((s) => s.id), [specs]);
  const byId = useMemo(() => new Map(specs.map((s) => [s.id, s])), [specs]);

  const [shown, setShown] = useState<string[]>([]);
  const [resolved, setResolved] = useState<Photo[]>([]);
  const cache = useRef<Map<string, { photo: Photo; at: number }>>(new Map());
  const cursor = useRef(0);
  const counter = useRef(0);
  // Ids seen on a previous pass — anything not in here is a genuinely new
  // upload (null until the first pass, so the initial load isn't "new").
  const knownIds = useRef<Set<string> | null>(null);

  // Keep `shown` valid and full as the library changes (also the initial fill).
  // A new upload is admitted immediately — it takes the hero frame with a
  // dissolve the moment Realtime delivers it, rather than waiting for rotation.
  useEffect(() => {
    const known = knownIds.current;
    const fresh = known ? orderedIds.filter((id) => !known.has(id)) : [];
    knownIds.current = new Set(orderedIds);
    setShown((prev) => {
      const next = reconcileShown(prev, orderedIds, limit, fresh);
      return sameIds(prev, next) ? prev : next;
    });
  }, [orderedIds, limit]);

  // Drift: one frame every ROTATE_EVERY_MS, cycling slots so it's never two at
  // once and — since the hero is a fixed slot — never the hero twice running.
  useEffect(() => {
    if (orderedIds.length <= limit) return; // nothing to rotate
    const timer = setInterval(() => {
      setShown((prev) => {
        if (prev.length === 0) return prev;
        const frame = counter.current % prev.length;
        counter.current += 1;
        const r = rotateSlot(prev, orderedIds, frame, cursor.current);
        cursor.current = r.cursor;
        return r.shown;
      });
    }, ROTATE_EVERY_MS);
    return () => clearInterval(timer);
  }, [orderedIds, limit]);

  // Resolve the shown ids to (cached) signed URLs. Unchanged slots return the
  // same url from cache, so only the freshly-rotated frame's src changes. A slow
  // re-sign keeps the kiosk's URLs alive well inside their TTL.
  useEffect(() => {
    let cancelled = false;
    const resolveAll = async () => {
      const out = await Promise.all(shown.map((id) => resolveSpec(byId.get(id), cache.current)));
      if (!cancelled) setResolved(out.filter((p): p is Photo => p !== null));
    };
    void resolveAll();
    const timer = setInterval(() => void resolveAll(), RESIGN_EVERY_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [shown, byId]);

  return resolved;
}
