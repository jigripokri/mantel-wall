// The canonical ICS parser. This file is the ONLY copy: the Deno Edge Function
// (supabase/functions/sync-calendar) imports it directly, and the browser module
// (src/modules/calendar/ics.ts) re-exports it. See MODULES.md § The ingest twin.
//
// It must stay runtime-agnostic — no Deno globals, no Node builtins, no imports
// beyond ical.js. The bare `ical.js` specifier is resolved by Vite from
// node_modules, and for Deno by an import map that must live in the *importing
// function's own directory* (supabase/functions/sync-calendar/deno.json) — a
// shared one at supabase/functions/deno.json is NOT picked up by the bundler and
// fails the deploy with "Relative import path not prefixed with / or ./ or ../".
// Any new function importing this file needs its own deno.json copy.
//
// The one rule that governs everything here: **the same input must produce the
// same output in Deno-on-UTC and in the Pi's browser.** ical.js ships no tzdata,
// so an unresolved TZID silently falls back to *runtime local* — which would
// make those two disagree. Every date path below is explicit about its zone.
import ICAL from "ical.js";
import { normalizeTzid, wallClockToUtc } from "./tz.ts";

export type CalendarFeed = { url: string; source: string; color: string };

/** A row ready to upsert. Structurally assignable to EntryUpsert in both
 *  src/lib/types.ts and _shared/upsert.ts. Every key is always present with an
 *  explicit null — PostgREST builds its column list from the union of keys
 *  across a batch, so an omitted key becomes a NULL *write* on rows that had a
 *  value. Never omit. */
export type IcsEntry = {
  type: "event";
  source: string;
  external_id: string;
  starts_at: string;
  ends_at: string | null;
  color: string;
  status: "active";
  payload: {
    title: string;
    location: string;
    allDay: boolean;
    /** Canonical name from PEOPLE when the summary carried a recognised
     *  "Name: " prefix, else null. The prefix is stripped from `title`. */
    person: string | null;
    /** For all-day events, the organizer's literal date (YYYY-MM-DD), so the
     *  wall can render the intended day without re-deriving it from an instant. */
    date: string | null;
  };
};

/** Canonical person name → colour. Comes from the PEOPLE Edge Function secret. */
export type PeopleMap = Record<string, string>;

/** Longest prefix we'll consider a name. Keeps the pattern from swallowing a
 *  sentence that merely contains a colon. */
const MAX_PERSON_LEN = 24;

/**
 * Split "Alex: Swim class" into a person and a clean title.
 *
 * The household runs one shared calendar, so a title prefix is the only way to
 * say whose event this is — Google's ICS export carries no per-event colour.
 *
 * **Only strips when the name is recognised.** An unknown prefix is left
 * completely alone: "Dentist: follow-up" must not silently become "follow-up",
 * and a typo like "Kav:" should surface as an unstyled row rather than quietly
 * render under the wrong person. Matching is case-insensitive but the canonical
 * spelling from PEOPLE is what gets stored, so "alex:" and "ALEX:" both
 * land as "Alex".
 */
export function splitPerson(
  summary: string,
  people: PeopleMap | undefined,
): { person: string | null; title: string } {
  const fallback = { person: null, title: summary.trim() || "(untitled)" };
  if (!people) return fallback;

  // Non-greedy on the FIRST colon only, so "Alex: Swim: level 3" keeps the
  // second colon in the title.
  const m = summary.match(/^\s*([^:]{1,24}?)\s*:\s+(\S.*?)\s*$/);
  if (!m || m[1].length > MAX_PERSON_LEN) return fallback;

  const candidate = m[1].toLowerCase();
  const canonical = Object.keys(people).find((k) => k.toLowerCase() === candidate);
  if (!canonical) return fallback;

  return { person: canonical, title: m[2] };
}

/**
 * Prefixes that look like a name but aren't in PEOPLE. Surfaced in the sync
 * response so a typo shows up as a line in the logs rather than as a row that
 * silently renders in the default colour forever.
 */
export function unknownPersonPrefixes(rows: IcsEntry[], people: PeopleMap | undefined): string[] {
  const seen = new Set<string>();
  for (const row of rows) {
    if (row.payload.person) continue;
    const m = row.payload.title.match(/^\s*([^:]{1,24}?)\s*:\s+\S/);
    if (m) seen.add(m[1].trim());
  }
  // Anything already known would have been stripped, so whatever is left here
  // is genuinely unrecognised.
  return [...seen].filter(
    (p) => !Object.keys(people ?? {}).some((k) => k.toLowerCase() === p.toLowerCase()),
  );
}

export type ParseOptions = {
  /** Expansion bounds. MUST be the same bounds the caller prunes with. */
  windowStart: Date;
  windowEnd: Date;
  /** IANA zone used for all-day anchoring and as the fallback for TZIDs that
   *  cannot be resolved from VTIMEZONE. */
  homeTz: string;
  /** Canonical name → colour. When a summary starts with a recognised
   *  "Name: " prefix, the prefix is stripped and the row takes that colour. */
  people?: PeopleMap;
  /** Emitted occurrences per event. */
  maxOccurrencesPerEvent?: number;
  /** Raw iterator steps per event, before window filtering. A DTSTART in 2009
   *  with FREQ=DAILY needs ~6000 steps to reach today; FREQ=SECONDLY never
   *  terminates. Bounded so a malformed feed cannot hang the sync. */
  maxIterationsPerEvent?: number;
};

const DEFAULT_MAX_OCCURRENCES = 400;
const DEFAULT_MAX_ITERATIONS = 8000;

/**
 * The rolling window, derived in ONE place so expansion and prune can never
 * disagree. A mismatch between them is either deleted-live-rows or
 * immortal-stale-rows.
 *
 * It reaches BACKWARDS a week because TvWall keeps an event visible while it is
 * in progress: a trip that started three days ago must stay inside the window,
 * or the reconcile reads it as vanished and deletes it mid-trip.
 */
export const WINDOW_BACK_DAYS = 7;
export const WINDOW_FORWARD_DAYS = 21;

export function windowFor(now: Date): { windowStart: Date; windowEnd: Date } {
  return {
    windowStart: new Date(now.getTime() - WINDOW_BACK_DAYS * 86_400_000),
    windowEnd: new Date(now.getTime() + WINDOW_FORWARD_DAYS * 86_400_000),
  };
}

/** True when ical.js could not resolve the value's zone and silently fell back
 *  to runtime-local — the divergence case we must handle ourselves. */
function isFloating(time: ICAL.Time): boolean {
  const zone = time.zone;
  if (!zone) return true;
  const tzid = zone.tzid;
  return !tzid || tzid === "floating" || zone === ICAL.Timezone.localTimezone;
}

/** Convert an ICAL.Time to a UTC instant, never trusting runtime-local. */
function icalTimeToUtc(time: ICAL.Time, declaredTzid: string | null, homeTz: string): Date {
  if (time.isDate) {
    // Date-only (all-day): anchor to midnight in the home zone, NOT UTC.
    return wallClockToUtc(
      { y: time.year, mo: time.month, d: time.day, h: 0, mi: 0, s: 0 },
      homeTz,
    );
  }
  if (time.zone === ICAL.Timezone.utcTimezone) {
    return new Date(time.toUnixTime() * 1000);
  }
  if (isFloating(time)) {
    // Either a truly floating value or an unresolvable TZID. Resolve the wall
    // clock ourselves so Deno-UTC and the Pi agree.
    return wallClockToUtc(
      { y: time.year, mo: time.month, d: time.day, h: time.hour, mi: time.minute, s: time.second },
      normalizeTzid(declaredTzid, homeTz),
    );
  }
  // A registered VTIMEZONE resolved it; ical.js has real offsets for this one.
  return new Date(time.toUnixTime() * 1000);
}

// ---------------------------------------------------------------------------
// VTIMEZONE registration (scoped — the service is a module-level singleton and
// Edge isolates are reused across invocations, so feed A must not leak into B)
// ---------------------------------------------------------------------------

function registerTimezones(vcalendar: ICAL.Component): string[] {
  const registered: string[] = [];
  for (const vt of vcalendar.getAllSubcomponents("vtimezone")) {
    const tzid = vt.getFirstPropertyValue("tzid") as string | null;
    if (!tzid || ICAL.TimezoneService.has(tzid)) continue;
    try {
      // register() takes the zone itself and derives the tzid from it.
      ICAL.TimezoneService.register(new ICAL.Timezone({ component: vt, tzid }));
      registered.push(tzid);
    } catch {
      // A malformed VTIMEZONE just means we fall through to the Intl path.
    }
  }
  return registered;
}

function unregisterTimezones(tzids: string[]): void {
  for (const tzid of tzids) {
    try {
      ICAL.TimezoneService.remove(tzid);
    } catch {
      /* best effort */
    }
  }
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

function tzidOf(comp: ICAL.Component, prop: string): string | null {
  const p = comp.getFirstProperty(prop);
  return (p?.getParameter("tzid") as string | undefined) ?? null;
}

/** Parse one ICS document into concrete, window-bounded rows. */
export function parseIcs(text: string, feed: CalendarFeed, opts: ParseOptions): IcsEntry[] {
  const maxOccurrences = opts.maxOccurrencesPerEvent ?? DEFAULT_MAX_OCCURRENCES;
  const maxIterations = opts.maxIterationsPerEvent ?? DEFAULT_MAX_ITERATIONS;
  const windowStartMs = opts.windowStart.getTime();
  const windowEndMs = opts.windowEnd.getTime();

  const vcalendar = new ICAL.Component(ICAL.parse(text));
  const registered = registerTimezones(vcalendar);

  try {
    const vevents = vcalendar.getAllSubcomponents("vevent");

    // Split masters from RECURRENCE-ID overrides. ical.js does NOT wire these up
    // on its own: without relateException an overridden occurrence renders at its
    // ORIGINAL time *and* the exception is emitted again as its own row.
    const masters: ICAL.Component[] = [];
    const overrides: ICAL.Component[] = [];
    for (const comp of vevents) {
      if (comp.getFirstProperty("recurrence-id")) overrides.push(comp);
      else masters.push(comp);
    }

    const overridesByUid = new Map<string, ICAL.Component[]>();
    for (const comp of overrides) {
      const uid = comp.getFirstPropertyValue("uid") as string | null;
      if (!uid) continue;
      const list = overridesByUid.get(uid);
      if (list) list.push(comp);
      else overridesByUid.set(uid, [comp]);
    }

    // Keyed by external_id so a collision cannot reach the upsert. Two rows
    // sharing a conflict key in one batch raises SQLSTATE 21000, which aborts
    // the ENTIRE statement — nothing lands. RDATE overlapping an RRULE instant
    // and merged calendars re-exporting a shared UID both produce this.
    const byExternalId = new Map<string, IcsEntry>();

    for (const comp of masters) {
      const uid = comp.getFirstPropertyValue("uid") as string | null;
      const status = (comp.getFirstPropertyValue("status") as string | null)?.toUpperCase();
      if (status === "CANCELLED") continue;

      const startTzid = tzidOf(comp, "dtstart");
      let event: ICAL.Event;
      try {
        event = new ICAL.Event(comp);
      } catch {
        continue;
      }
      if (!event.startDate) continue; // unparseable DTSTART: a null starts_at
      // would escape the starts_at-bounded prune and linger forever.

      if (uid) {
        for (const ov of overridesByUid.get(uid) ?? []) {
          try {
            event.relateException(new ICAL.Event(ov));
          } catch {
            /* mismatched exception — ignore rather than lose the series */
          }
        }
      }

      const emit = (
        startTime: ICAL.Time,
        endTime: ICAL.Time | null,
        recurrenceKey: string | null,
        item: ICAL.Event,
      ) => {
        const startsAt = icalTimeToUtc(startTime, startTzid, opts.homeTz);
        const startMs = startsAt.getTime();
        if (!Number.isFinite(startMs)) return;
        if (startMs < windowStartMs || startMs >= windowEndMs) return;

        const allDay = startTime.isDate;
        // All-day DTEND is EXCLUSIVE — a one-day event on the 20th carries
        // DTEND;VALUE=DATE:20260721 — which means it is already the correct END
        // INSTANT for interval math. Do NOT subtract a day: TvWall's agenda
        // filter is `ends_at >= now`, so shifting it back would make a one-day
        // event expire before it began and never appear at all. The organizer's
        // intended display date travels separately in `payload.date`.
        const endsAt: Date | null = endTime
          ? icalTimeToUtc(endTime, tzidOf(comp, "dtend"), opts.homeTz)
          : null;

        const baseId = uid ?? `${feed.source}:${item.summary ?? ""}:${startTime.toICALString()}`;
        const externalId = recurrenceKey ? `${baseId}::${recurrenceKey}` : baseId;

        const { person, title } = splitPerson(item.summary ?? "(untitled)", opts.people);

        byExternalId.set(externalId, {
          type: "event",
          source: feed.source,
          external_id: externalId,
          starts_at: startsAt.toISOString(),
          ends_at: endsAt ? endsAt.toISOString() : null,
          color: person ? (opts.people?.[person] ?? feed.color) : feed.color,
          status: "active",
          payload: {
            title,
            location: item.location ?? "",
            allDay,
            person,
            date: allDay
              ? `${String(startTime.year).padStart(4, "0")}-${String(startTime.month).padStart(2, "0")}-${String(startTime.day).padStart(2, "0")}`
              : null,
          },
        });
      };

      if (!event.isRecurring()) {
        emit(event.startDate, event.endDate ?? null, null, event);
        continue;
      }

      const iterator = event.iterator();
      let emitted = 0;
      let steps = 0;
      for (;;) {
        if (steps++ >= maxIterations || emitted >= maxOccurrences) break;
        let next: ICAL.Time | null;
        try {
          next = iterator.next();
        } catch {
          break;
        }
        if (!next) break;

        let details;
        try {
          details = event.getOccurrenceDetails(next);
        } catch {
          continue;
        }

        const occStartMs = icalTimeToUtc(details.startDate, startTzid, opts.homeTz).getTime();
        if (occStartMs >= windowEndMs) break; // series has passed the window
        if (occStartMs < windowStartMs) continue; // not there yet

        // Key on RECURRENCE-ID, not on the occurrence start: dragging one
        // instance of a weekly meeting changes the start but NOT the
        // recurrence id, so keying on start would orphan a row on every edit.
        // toICALString() is the feed's own wall-clock form — stable regardless
        // of how we resolved the zone.
        emit(
          details.startDate,
          details.endDate ?? null,
          details.recurrenceId.toICALString(),
          details.item,
        );
        emitted++;
      }
    }

    return [...byExternalId.values()];
  } finally {
    unregisterTimezones(registered);
  }
}

// ---------------------------------------------------------------------------
// Feed fetching + prune eligibility
// ---------------------------------------------------------------------------

export type FeedOutcome =
  | { source: string; ok: true; rows: IcsEntry[] }
  | { source: string; ok: false; reason: string };

/** A 200 is NOT success. Revoked Google/iCloud secret URLs return 200 with an
 *  HTML login page, which parses to zero events and is indistinguishable from a
 *  genuinely empty calendar — and would let the prune wipe the feed. */
export function looksLikeIcs(body: string): boolean {
  return /^\s*BEGIN:VCALENDAR/i.test(body);
}

/** Reject duplicate `source` values up front. Two feeds sharing a source break
 *  the per-source prune (one wipes the other) and can collide on the unique
 *  index when both export the same UID. */
export function assertUniqueSources(feeds: CalendarFeed[]): void {
  const seen = new Set<string>();
  for (const f of feeds) {
    if (seen.has(f.source)) {
      throw new Error(`CALENDAR_FEEDS has duplicate source "${f.source}" — sources must be unique`);
    }
    seen.add(f.source);
  }
}

export async function fetchFeeds(
  feeds: CalendarFeed[],
  opts: ParseOptions,
  fetchImpl: typeof fetch,
): Promise<FeedOutcome[]> {
  assertUniqueSources(feeds);
  return Promise.all(
    feeds.map(async (feed): Promise<FeedOutcome> => {
      try {
        const res = await fetchImpl(feed.url);
        if (!res.ok) return { source: feed.source, ok: false, reason: `HTTP ${res.status}` };
        const body = await res.text();
        if (!looksLikeIcs(body)) {
          return { source: feed.source, ok: false, reason: "response is not an ICS document" };
        }
        return { source: feed.source, ok: true, rows: parseIcs(body, feed, opts) };
      } catch (e) {
        return { source: feed.source, ok: false, reason: String(e) };
      }
    }),
  );
}
