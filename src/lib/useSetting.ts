import { useEffect, useRef, useState } from "react";
import { supabase, HAS_SUPABASE } from "./supabase";
import { useSession } from "./useSession";

/** Mock-mode persistence key, so the offline preview's setting survives reloads
 *  and syncs across tabs (standing in for Realtime). */
const MOCK_KEY = (key: string) => `mantel_setting_${key}`;

function readMock<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(MOCK_KEY(key));
    return raw != null ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/**
 * A single row of `app_settings`, read live and writable by a family session.
 *
 * This is the app's first browser write path. Reads and the upsert are both
 * gated by the same `is_family()` RLS as everything else (0006_app_settings.sql)
 * — signing in is not the same as being allowed in, and the write simply fails
 * for a non-family session rather than needing a UI check.
 *
 * Mirrors useEntries: waits for the session before querying (an anonymous read
 * returns nothing under RLS), and re-subscribes to Realtime when the token
 * changes. In mock mode it is backed by `localStorage` and synced across tabs
 * via the `storage` event, so the phone picker actually drives the wall offline
 * too — the same cross-route behaviour Realtime gives with a cloud account.
 */
export function useSetting<T>(
  key: string,
  fallback: T,
): { value: T; setValue: (next: T | ((prev: T) => T)) => void; loading: boolean } {
  const [value, setValueState] = useState<T>(() => (HAS_SUPABASE ? fallback : readMock(key, fallback)));
  const [loading, setLoading] = useState(HAS_SUPABASE);
  const { session, email, loading: sessionLoading } = useSession();

  // Latest value, so a functional setValue composes on it rather than a stale
  // closure. Read-modify-write updates (tap a star three times fast) would
  // otherwise clobber each other.
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    if (!HAS_SUPABASE || !supabase) return; // mock mode: local state only
    if (sessionLoading) return;
    if (!session) {
      setValueState(fallback);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const client = supabase;

    client
      .from("app_settings")
      .select("value")
      .eq("key", key)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) console.warn("[useSetting] read failed", key, error.message);
        if (data?.value !== undefined && data.value !== null) setValueState(data.value as T);
        setLoading(false);
      });

    const channel = client
      .channel(`setting-${key}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "app_settings", filter: `key=eq.${key}` },
        (payload) => {
          const next = (payload.new as { value?: T } | null)?.value;
          if (next !== undefined && next !== null) setValueState(next);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      client.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, session, sessionLoading]);

  // Mock mode: back the setting with localStorage and sync across tabs via the
  // `storage` event, so switching on the phone route repaints the wall route
  // exactly as Realtime would with a cloud account.
  useEffect(() => {
    if (HAS_SUPABASE) return;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== MOCK_KEY(key)) return;
      try {
        setValueState(e.newValue != null ? (JSON.parse(e.newValue) as T) : fallback);
      } catch {
        /* ignore a malformed value */
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const setValue = (next: T | ((prev: T) => T)) => {
    const resolved =
      typeof next === "function" ? (next as (prev: T) => T)(valueRef.current) : next;
    valueRef.current = resolved;
    setValueState(resolved); // optimistic — the wall shouldn't wait on a round-trip
    if (!HAS_SUPABASE || !supabase) {
      try {
        localStorage.setItem(MOCK_KEY(key), JSON.stringify(resolved));
      } catch {
        /* ignore */
      }
      return;
    }
    supabase
      .from("app_settings")
      .upsert({ key, value: resolved, updated_by: email }, { onConflict: "key" })
      .then(({ error }) => {
        if (error) console.error("[useSetting] write failed", key, error.message);
      });
  };

  return { value, setValue, loading };
}
