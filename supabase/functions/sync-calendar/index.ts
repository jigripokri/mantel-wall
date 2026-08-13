// Scheduled ingest: fetch each ICS feed, expand recurrences into a rolling
// window, and reconcile that window in `entries`.
//
// The parser is NOT duplicated here any more — it lives at _shared/ics.ts and is
// the same code the browser imports and the test suite exercises under two host
// timezones. See MODULES.md § The ingest twin.
import { syncWindow, json, recordSyncHealth, type EntryUpsert } from "../_shared/upsert.ts";
import {
  fetchFeeds,
  windowFor,
  unknownPersonPrefixes,
  type CalendarFeed,
  type ParseOptions,
  type PeopleMap,
} from "../_shared/ics.ts";

Deno.serve(async () => {
  try {
    const feeds: CalendarFeed[] = JSON.parse(Deno.env.get("CALENDAR_FEEDS") ?? "[]");
    const homeTz = Deno.env.get("HOME_TZ") ?? "America/Los_Angeles";
    // Name → colour. The household shares one calendar, so a "Name: " title
    // prefix is the only per-event signal available; Google's ICS carries no
    // per-event colour.
    const people: PeopleMap = JSON.parse(Deno.env.get("PEOPLE") ?? "{}");

    // Expansion and prune MUST share these exact bounds.
    const { windowStart, windowEnd } = windowFor(new Date());
    const opts: ParseOptions = { windowStart, windowEnd, homeTz, people };

    // Throws on duplicate `source` values before anything is written.
    const outcomes = await fetchFeeds(feeds, opts, fetch);

    const report: Record<string, unknown>[] = [];
    for (const outcome of outcomes) {
      if (!outcome.ok) {
        // Do NOT reconcile this source. An unreachable feed means "we don't
        // know what this calendar contains", not "this calendar is empty" —
        // pruning here would let one transient 503 blank a family member's
        // calendar off the wall until the next successful run.
        console.error(`[calendar] ${outcome.source} failed: ${outcome.reason} — left untouched`);
        await recordSyncHealth(outcome.source, { ok: false, error: outcome.reason });
        report.push({ source: outcome.source, ok: false, reason: outcome.reason, skipped: true });
        continue;
      }

      const stats = await syncWindow({
        source: outcome.source,
        type: "event",
        windowStart,
        windowEnd,
        rows: outcome.rows as EntryUpsert[],
        allowPrune: true,
      });
      if (stats.prunedSkipped) console.warn(`[calendar] ${outcome.source}: ${stats.prunedSkipped}`);

      // A title like "Kav: swim" looks intentional but matches nobody, so it
      // renders in the default colour forever. Surface it rather than let it
      // hide.
      const unknown = unknownPersonPrefixes(outcome.rows, people);
      if (unknown.length) {
        console.warn(`[calendar] ${outcome.source}: unrecognised name prefixes: ${unknown.join(", ")}`);
      }

      await recordSyncHealth(outcome.source, { ok: true });

      report.push({
        source: outcome.source,
        ok: true,
        parsed: outcome.rows.length,
        ...stats,
        ...(unknown.length ? { unknownPrefixes: unknown } : {}),
      });
    }

    const failed = outcomes.filter((o) => !o.ok).length;
    return json(
      {
        ok: failed === 0,
        window: { start: windowStart.toISOString(), end: windowEnd.toISOString(), homeTz },
        feeds: report,
      },
      // 207: some feeds landed, some didn't. Distinguishable from a total
      // failure in the cron logs.
      failed === 0 ? 200 : failed === outcomes.length ? 500 : 207,
    );
  } catch (e) {
    console.error("[calendar] failed", e);
    return json({ ok: false, error: String(e) }, 500);
  }
});
