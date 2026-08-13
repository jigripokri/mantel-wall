// Timezone primitives, shared by ingest (Deno) and the wall (browser).
//
// Zero dependencies on purpose — `Intl` carries real tzdata in both runtimes,
// which is exactly what ical.js does not. Nothing here may read runtime-local
// time: every conversion names its zone explicitly.

export type WallClock = { y: number; mo: number; d: number; h: number; mi: number; s: number };

/** Windows/Outlook zone names that appear in school-district exports and will
 *  never match an IANA id. Not exhaustive — unmatched names fall back to home. */
export const WINDOWS_TZ_ALIASES: Record<string, string> = {
  "Pacific Standard Time": "America/Los_Angeles",
  "Pacific Daylight Time": "America/Los_Angeles",
  "Mountain Standard Time": "America/Denver",
  "Central Standard Time": "America/Chicago",
  "Eastern Standard Time": "America/New_York",
  "Alaskan Standard Time": "America/Anchorage",
  "Hawaiian Standard Time": "Pacific/Honolulu",
  "GMT Standard Time": "Europe/London",
  "W. Europe Standard Time": "Europe/Berlin",
  "India Standard Time": "Asia/Kolkata",
  UTC: "UTC",
};

const validity = new Map<string, boolean>();

export function isUsableTimeZone(tz: string): boolean {
  const cached = validity.get(tz);
  if (cached !== undefined) return cached;
  let ok = true;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
  } catch {
    ok = false;
  }
  validity.set(tz, ok);
  return ok;
}

/** Resolve an ICS TZID to something Intl accepts, else fall back to `home`. */
export function normalizeTzid(tzid: string | null | undefined, home: string): string {
  if (!tzid) return home;
  const trimmed = tzid.replace(/^\//, ""); // some feeds emit /America/Los_Angeles
  if (isUsableTimeZone(trimmed)) return trimmed;
  const aliased = WINDOWS_TZ_ALIASES[tzid] ?? WINDOWS_TZ_ALIASES[trimmed];
  if (aliased && isUsableTimeZone(aliased)) return aliased;
  return home;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatters.set(timeZone, f);
  }
  return f;
}

/** The wall-clock reading of an instant in `timeZone`. */
export function partsIn(instant: Date, timeZone: string): WallClock {
  const p: Record<string, string> = {};
  for (const part of formatterFor(timeZone).formatToParts(instant)) p[part.type] = part.value;
  return {
    y: Number(p.year),
    mo: Number(p.month),
    d: Number(p.day),
    h: Number(p.hour) % 24, // some engines render midnight as "24"
    mi: Number(p.minute),
    s: Number(p.second),
  };
}

/** Offset of `timeZone` from UTC at a given instant, in ms. */
export function tzOffsetMs(instantMs: number, timeZone: string): number {
  const p = partsIn(new Date(instantMs), timeZone);
  return Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s) - instantMs;
}

/**
 * Interpret a wall-clock reading as an instant in `timeZone`.
 *
 * Probe once, then re-probe with the corrected offset so DST transitions settle:
 * 09:00 wall-clock is 16:00Z in July and 17:00Z in December, and a single probe
 * lands on the wrong side of the boundary for times near the transition.
 */
export function wallClockToUtc(wc: WallClock, timeZone: string): Date {
  const naive = Date.UTC(wc.y, wc.mo - 1, wc.d, wc.h, wc.mi, wc.s);
  const first = tzOffsetMs(naive, timeZone);
  let instant = naive - first;
  const second = tzOffsetMs(instant, timeZone);
  if (second !== first) instant = naive - second;
  return new Date(instant);
}

/** Days since epoch in `timeZone` — the unit for Today/Tomorrow comparisons. */
export function dayNumberIn(instant: Date, timeZone: string): number {
  const p = partsIn(instant, timeZone);
  return Date.UTC(p.y, p.mo - 1, p.d) / 86_400_000;
}
