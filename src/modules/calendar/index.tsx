import type { FeatureModule, IngestContext, EntryUpsert } from "../../lib/types";
import type { CalendarFeed } from "./ics";
import { CalendarTile } from "./CalendarTile";

/**
 * Feeds come from env as JSON:
 *   CALENDAR_FEEDS='[{"url":"https://...ics","source":"google_cal","color":"hsl(42 60% 62%)"}]'
 * In the browser this stays empty (secret ICS URLs never ship to the client);
 * ingest runs only in the Edge Function.
 */
function readFeeds(env: Record<string, string | undefined>): CalendarFeed[] {
  const raw = env.CALENDAR_FEEDS;
  if (!raw) return [];
  try {
    return JSON.parse(raw) as CalendarFeed[];
  } catch {
    console.error("[calendar] CALENDAR_FEEDS is not valid JSON");
    return [];
  }
}

async function ingest(ctx: IngestContext): Promise<EntryUpsert[]> {
  const feeds = readFeeds(ctx.env);
  if (feeds.length === 0) return [];

  // Loaded lazily so Rollup code-splits ical.js (~70KB) out of the Pi's main
  // chunk. This path never runs in the browser — CALENDAR_FEEDS is an Edge
  // Function secret and is never present client-side — so the wall should not
  // pay to download a parser it will not use.
  const { fetchFeeds, windowFor } = await import("./ics");

  const { windowStart, windowEnd } = windowFor(ctx.now);
  const outcomes = await fetchFeeds(
    feeds,
    { windowStart, windowEnd, homeTz: ctx.env.HOME_TZ ?? "America/Los_Angeles" },
    ctx.fetch,
  );

  const rows: EntryUpsert[] = [];
  for (const outcome of outcomes) {
    if (outcome.ok) rows.push(...outcome.rows);
    else console.error(`[calendar] ${outcome.source} failed: ${outcome.reason}`);
  }
  return rows;
}

export const calendarModule: FeatureModule = {
  type: "event",
  label: "Calendar",
  layer: "overlay",
  ingest,
  TvTile: CalendarTile,
  showOnTv: (e) => e.status === "active" && e.type === "event",
};
