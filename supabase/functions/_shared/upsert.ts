// Shared by every ingest function. Uses the service-role key (bypasses RLS) to
// upsert on (source, external_id) — the idempotency key. Deno runtime.
import { createClient } from "jsr:@supabase/supabase-js@2";

export type EntryUpsert = {
  type: string;
  source?: string | null;
  external_id?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  due_at?: string | null;
  expires_at?: string | null;
  status?: string;
  color?: string | null;
  payload?: Record<string, unknown>;
  media_key?: string | null;
};

export function serviceClient() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function upsertEntries(rows: EntryUpsert[]): Promise<number> {
  if (rows.length === 0) return 0;
  const db = serviceClient();
  const { error } = await db
    .from("entries")
    .upsert(rows, { onConflict: "source,external_id", ignoreDuplicates: false });
  if (error) throw error;
  return rows.length;
}

// ---------------------------------------------------------------------------
// Windowed read-diff-write
// ---------------------------------------------------------------------------

export type SyncStats = {
  inserted: number;
  updated: number;
  deleted: number;
  unchanged: number;
  prunedSkipped?: string;
};

/** Timestamps round-trip differently than we write them (Postgres returns
 *  `+00:00`, we send `.000Z`), so compare instants, never strings. */
function sameInstant(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return new Date(a).getTime() === new Date(b).getTime();
}

/** Key-order-independent structural compare for `payload`. */
function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical(obj[k])}`).join(",")}}`;
}

type ExistingRow = {
  id: string;
  external_id: string | null;
  starts_at: string | null;
  ends_at: string | null;
  color: string | null;
  status: string | null;
  payload: Record<string, unknown> | null;
};

function unchangedFrom(existing: ExistingRow, desired: EntryUpsert): boolean {
  return (
    sameInstant(existing.starts_at, desired.starts_at) &&
    sameInstant(existing.ends_at, desired.ends_at) &&
    existing.color === (desired.color ?? null) &&
    (existing.status ?? "active") === (desired.status ?? "active") &&
    canonical(existing.payload ?? {}) === canonical(desired.payload ?? {})
  );
}

/**
 * Reconcile one (source, type) window to exactly `rows`.
 *
 * Deliberately NOT a blind upsert of the whole window. Postgres ON CONFLICT DO
 * UPDATE always writes a new tuple even when every column is identical, so a
 * blind re-upsert of ~300-800 expanded occurrences would emit that many Realtime
 * UPDATE messages every 15 minutes forever, to change nothing — enough to risk
 * Supabase throttling the wall into silent staleness. Reading first and writing
 * only genuine changes makes the steady state cost zero Realtime traffic.
 *
 * `allowPrune: false` reconciles without deleting — used when the feed that owns
 * this source failed to fetch, so absence of a row means "we don't know", not
 * "it was cancelled".
 */
export async function syncWindow(args: {
  source: string;
  type: string;
  windowStart: Date;
  windowEnd: Date;
  rows: EntryUpsert[];
  allowPrune: boolean;
}): Promise<SyncStats> {
  const db = serviceClient();
  const stats: SyncStats = { inserted: 0, updated: 0, deleted: 0, unchanged: 0 };

  const { data, error: readErr } = await db
    .from("entries")
    .select("id, external_id, starts_at, ends_at, color, status, payload")
    .eq("source", args.source)
    .eq("type", args.type)
    .gte("starts_at", args.windowStart.toISOString())
    .lt("starts_at", args.windowEnd.toISOString());
  if (readErr) throw readErr;

  const existing = new Map<string, ExistingRow>();
  for (const row of (data ?? []) as ExistingRow[]) {
    if (row.external_id) existing.set(row.external_id, row);
  }

  const toWrite: EntryUpsert[] = [];
  const desiredIds = new Set<string>();
  for (const row of args.rows) {
    if (!row.external_id) continue; // a null external_id silently defeats the
    // unique index (NULLs compare distinct) and would duplicate without bound.
    desiredIds.add(row.external_id);
    const prior = existing.get(row.external_id);
    if (!prior) {
      toWrite.push(row);
      stats.inserted++;
    } else if (!unchangedFrom(prior, row)) {
      toWrite.push(row);
      stats.updated++;
    } else {
      stats.unchanged++;
    }
  }

  if (toWrite.length > 0) {
    const { error } = await db
      .from("entries")
      .upsert(toWrite, { onConflict: "source,external_id", ignoreDuplicates: false });
    if (error) throw error;
  }

  const orphanIds = [...existing.values()]
    .filter((row) => row.external_id && !desiredIds.has(row.external_id))
    .map((row) => row.id);

  if (orphanIds.length > 0) {
    if (!args.allowPrune) {
      stats.prunedSkipped = `feed failed; kept ${orphanIds.length} existing row(s)`;
    } else if (args.rows.length === 0 && existing.size > 0) {
      // A calendar going from N events to zero in one run is far more likely to
      // be a broken feed than a genuinely emptied calendar. A stale row is
      // recoverable; a deleted one is not.
      stats.prunedSkipped = `refused to prune ${existing.size} row(s) on an empty result`;
    } else {
      const { error } = await db.from("entries").delete().in("id", orphanIds);
      if (error) throw error;
      stats.deleted = orphanIds.length;
    }
  }

  return stats;
}

/**
 * Record that a sync ran, whether or not it changed anything.
 *
 * Deliberately best-effort: a failure to write the heartbeat must never fail
 * the sync itself. Losing the freshness signal is bad; losing the calendar
 * because bookkeeping threw is worse.
 */
export async function recordSyncHealth(
  source: string,
  result: { ok: true } | { ok: false; error: string },
): Promise<void> {
  try {
    const db = serviceClient();
    const now = new Date().toISOString();
    if (result.ok) {
      await db.from("sync_health").upsert(
        {
          source,
          last_run_at: now,
          last_success_at: now,
          last_error: null,
          last_error_at: null,
          consecutive_failures: 0,
        },
        { onConflict: "source" },
      );
    } else {
      // Read first so the failure counter accumulates rather than resetting.
      const { data } = await db
        .from("sync_health")
        .select("consecutive_failures")
        .eq("source", source)
        .maybeSingle();
      await db.from("sync_health").upsert(
        {
          source,
          last_run_at: now,
          last_error: result.error.slice(0, 500),
          last_error_at: now,
          consecutive_failures: ((data?.consecutive_failures as number | undefined) ?? 0) + 1,
        },
        { onConflict: "source" },
      );
    }
  } catch (e) {
    console.error("[sync_health] could not record", source, e);
  }
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
