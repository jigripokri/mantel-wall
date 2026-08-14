import type { DayPart } from "./types";
import { partsIn, dayNumberIn, wallClockToUtc } from "../../supabase/functions/_shared/tz.ts";

/**
 * The wall renders in ONE explicit zone — the home the mantel lives in — never
 * in whatever zone the host happens to be set to.
 *
 * This matters more than it looks. The Pi is a kiosk; Raspberry Pi OS ships set
 * to UTC unless someone ran `raspi-config`. With runtime-local time the whole
 * wall would silently sit 7-8 hours off: the wrong greeting, Today's events
 * filed under Tomorrow, every clock time wrong — on a 75" panel in the kitchen,
 * with nothing to indicate why. Pinning the zone makes the wall correct
 * regardless of how the Pi was flashed.
 */
export const HOME_TZ: string =
  (import.meta.env?.VITE_HOME_TZ as string | undefined) ?? "America/Los_Angeles";

export function dayPart(now: Date): DayPart {
  const h = partsIn(now, HOME_TZ).h;
  if (h < 5) return "night";
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  if (h < 21) return "evening";
  return "night";
}

export function greeting(now: Date): string {
  const p = dayPart(now);
  if (p === "morning") return "Good morning";
  if (p === "afternoon") return "Good afternoon";
  if (p === "evening") return "Good evening";
  return "Good night";
}

export function isSameDay(a: Date, b: Date): boolean {
  return dayNumberIn(a, HOME_TZ) === dayNumberIn(b, HOME_TZ);
}

/**
 * The big wall clock, in the home zone.
 *
 * This was the one thing on the wall still formatted from the *host* zone,
 * which put it hours out of step with the greeting, the date line and every
 * event time beside it — the exact failure the module header warns about, on
 * the exact machine it describes. A Pi flashed without `raspi-config` showed
 * "GOOD MORNING" over an afternoon clock.
 *
 * Locale stays the host's: a household on a 24-hour locale should get a
 * 24-hour wall. Only the zone is pinned. Both layouts render the meridiem
 * smaller than the digits, so this hands back the two pieces already split —
 * and `meridiem` is legitimately empty on a 24-hour locale.
 */
export function fmtClock(now: Date): { clock: string; meridiem: string } {
  const [clock, meridiem = ""] = now
    .toLocaleTimeString([], { hour: "numeric", minute: "2-digit", timeZone: HOME_TZ })
    .split(" ");
  return { clock, meridiem };
}

export function fmtTime(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    timeZone: HOME_TZ,
  });
}

export function fmtDayLabel(now: Date, target: Date): string {
  // Whole-day difference in the home zone. Counting calendar days directly
  // avoids the DST-week case where two local midnights are 23 or 25 hours apart.
  const diff = dayNumberIn(target, HOME_TZ) - dayNumberIn(now, HOME_TZ);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return target.toLocaleDateString([], { weekday: "long", timeZone: HOME_TZ });
}

/** The home zone's calendar day as a number — the stable key for grouping past
 *  events into days without ever touching the host zone. */
export function homeDayNumber(d: Date): number {
  return dayNumberIn(d, HOME_TZ);
}

/** "Today" / "Yesterday" / "Mon, Jul 20" — a past-facing day heading. Weekday
 *  alone (as fmtDayLabel gives) goes ambiguous once history runs past a week,
 *  so anything older than yesterday carries its date. */
export function fmtPastDayLabel(now: Date, target: Date): string {
  const diff = dayNumberIn(now, HOME_TZ) - dayNumberIn(target, HOME_TZ);
  if (diff <= 0) return "Today";
  if (diff === 1) return "Yesterday";
  return target.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: HOME_TZ,
  });
}

export function startOfDay(d: Date): Date {
  const p = partsIn(d, HOME_TZ);
  return wallClockToUtc({ y: p.y, mo: p.mo, d: p.d, h: 0, mi: 0, s: 0 }, HOME_TZ);
}

/** "Tomorrow" / "in 4 days" / "in 2 weeks" — a calm countdown to a future day,
 *  counted in home-zone calendar days so it never drifts by a UTC boundary. */
export function countdownLabel(now: Date, target: Date): string {
  const days = dayNumberIn(target, HOME_TZ) - dayNumberIn(now, HOME_TZ);
  if (days <= 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days < 14) return `in ${days} days`;
  return `in ${Math.round(days / 7)} weeks`;
}
