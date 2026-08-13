import { fmtTime, fmtDayLabel, isSameDay } from "./time";
import type { Entry } from "./types";

/** "68° Clear" — the wall's one-line weather. */
export function formatWeather(entry: Entry): string {
  const p = entry.payload as { tempF?: number; summary?: string };
  return [p.tempF != null ? `${Math.round(p.tempF)}°` : null, p.summary]
    .filter(Boolean)
    .join(" ");
}

/**
 * The meta line beside an event title: time for today, day + time beyond it,
 * plus the person as a dim second signal.
 *
 * The coloured dot carries whose event this is pre-attentively; the name is the
 * second signal. Per the person-palette note in src/index.css, colour is never
 * the only one — that rule is what keeps the wall readable for a colour-blind
 * viewer, and it is layout-independent, so it lives here rather than in a layout.
 */
export function eventMeta(entry: Entry, now: Date): string {
  if (!entry.starts_at) return "";
  const p = entry.payload as { allDay?: boolean; person?: string | null };
  const d = new Date(entry.starts_at);

  const when = p.allDay
    ? isSameDay(d, now)
      ? "All day"
      : `${fmtDayLabel(now, d)} · all day`
    : isSameDay(d, now)
      ? fmtTime(entry.starts_at)
      : `${fmtDayLabel(now, d)} ${fmtTime(entry.starts_at)}`;

  return p.person ? `${when} · ${p.person}` : when;
}
