import type { FC } from "react";

/**
 * The cornerstone. Every feature lands here as a row and renders as a tile.
 * Mirrors the `entries` table (supabase/migrations/0001_entries.sql) 1:1.
 */
export type Entry = {
  id: string;
  type: string; // 'event' | 'todo' | 'photo' | 'weather' | ...
  source: string | null; // 'google_cal' | 'icloud' | 'school' | 'google_tasks' | 'upload'
  created_by: string | null;
  created_at: string;
  updated_at: string;
  starts_at: string | null;
  ends_at: string | null;
  due_at: string | null;
  expires_at: string | null;
  status: "active" | "done" | "archived";
  color: string | null;
  external_id: string | null;
  pinned: boolean;
  sort_order: number;
  payload: Record<string, unknown>;
  media_key: string | null;
};

/** Row shape for an upsert during ingest. id/created_at/updated_at are DB-managed. */
export type EntryUpsert = Partial<Omit<Entry, "id" | "created_at" | "updated_at">> &
  Pick<Entry, "type">;

/**
 * The Feature Module contract — two flavors, one shape.
 *   - INGEST modules (calendar, weather, tasks): `ingest` pulls external data on a schedule.
 *   - CONTRIBUTION modules (photos): `PhoneForm` lets a family member add via phone.
 * Adding a feature = one module file + one line in MODULES.
 */
export type FeatureModule = {
  /** matches Entry.type */
  type: string;
  label: string;
  Icon?: FC;

  /** CONTRIBUTION flavor: rendered on the phone route so family can add. */
  PhoneForm?: FC<{ onDone: () => void }>;

  /** INGEST flavor: runs in an Edge Function on a schedule. Returns rows to upsert.
   *  Kept pure (no DB handle) so it runs identically in a test and in the Edge Function. */
  ingest?: (ctx: IngestContext) => Promise<EntryUpsert[]>;

  /** render one entry on the wall */
  TvTile: FC<{ entry: Entry }>;

  /** filter which entries this module paints on the wall right now */
  showOnTv?: (e: Entry, now: Date) => boolean;

  rotationWeight?: number;
  layer?: "background" | "overlay";
};

/** Injected into ingest() so it never reads process.env directly. */
export type IngestContext = {
  now: Date;
  env: Record<string, string | undefined>;
  fetch: typeof fetch;
};

export type DayPart = "morning" | "afternoon" | "evening" | "night";
