import { isSameDay } from "./time";
import type { Entry } from "./types";

/** Lists cap, never clip — overflow becomes one faint "+ n more" line. */
export const MAX_ROWS = 3;

/** How far ahead the wall will reach to fill its rows. Beyond a week it stops
 *  being "coming up" and starts being a planner. */
export const LOOKAHEAD_DAYS = 7;

export type Agenda = {
  rows: Entry[];
  /** Events remaining TODAY beyond the rows shown. */
  more: number;
  /** True when at least one shown row falls today. */
  hasToday: boolean;
  /** True when EVERY shown row is today. The heading only says a bare "Today"
   *  in this case — otherwise it would sit over rows tagged "Tomorrow". */
  allToday: boolean;
};

/**
 * The next few things, wherever they fall.
 *
 * Deliberately NOT "today's agenda". On this calendar seven of the next
 * fourteen days hold exactly one event and two hold none, so a strictly-today
 * list leaves the column nearly bare most of the time. A rolling horizon
 * removes the empty state as a concept rather than designing around it: the
 * list stays full while anything is coming, rows carry their day unless they
 * are today, and the heading still answers "is today free?".
 *
 * This also subsumes the old evening/`leadsTomorrow` special case — once
 * today's events end they drop out on their own and tomorrow's rise to fill the
 * gap, which is what that flag was approximating.
 */
export function selectAgenda(events: Entry[], now: Date): Agenda {
  const horizon = new Date(now.getTime() + LOOKAHEAD_DAYS * 86_400_000);

  const upcoming = events
    .filter((e) => e.starts_at)
    .map((e) => ({ e, at: new Date(e.starts_at!) }))
    // An event that has started but not ended is still "now" — keep it visible.
    .filter(({ e, at }) => new Date(e.ends_at ?? e.starts_at!) >= now && at < horizon)
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .map(({ e }) => e);

  const rows = upcoming.slice(0, MAX_ROWS);
  const isToday = (e: Entry) => isSameDay(new Date(e.starts_at!), now);

  // "+ n more" counts what is left TODAY, not what is left this week. With a
  // rolling horizon the week almost always has more, so counting the week would
  // pin a large meaningless number to the wall permanently.
  const todayTotal = upcoming.filter(isToday).length;
  const todayShown = rows.filter(isToday).length;

  return {
    rows,
    more: Math.max(0, todayTotal - todayShown),
    hasToday: todayShown > 0,
    allToday: rows.length > 0 && todayShown === rows.length,
  };
}

/**
 * The agenda heading: "Today" or "Coming up". "Today" only when every shown row
 * really is today — the moment the rolling list spills into a later day it
 * becomes "Coming up", so the header never sits over rows tagged "Tomorrow".
 * (Two labels by request; the all-today check is what keeps it honest.)
 * Shared so both layouts agree.
 */
export function agendaHeading(agenda: Agenda): string {
  return agenda.allToday ? "Today" : "Coming up";
}

/** Open tasks first, done last. Layout-independent, so it lives beside the
 *  agenda selection both layouts share. */
export function selectTodos(entries: Entry[]): Entry[] {
  return entries
    .filter((e) => e.type === "todo" && e.status !== "archived")
    .sort((a, b) => Number(a.status === "done") - Number(b.status === "done"));
}

/** How far ahead "Up next" looks — the ingest window, so it never promises
 *  something that isn't actually loaded. */
export const UP_NEXT_DAYS = 21;

const titleKey = (e: Entry) =>
  String((e.payload as { title?: string }).title ?? "")
    .trim()
    .toLowerCase();

/**
 * The next *notable* thing to keep an eye out for, within the ingest window.
 *
 * "Notable" is defined by what this family's calendar actually looks like:
 * routine repeats (Taekwondo ×10, Swim ×2) and one-offs (a birthday, an early
 * pickup, a friend's party) appear once. So the signal is frequency — a title
 * that recurs in the calendar is routine; a title that appears once is notable.
 * That matches "early school closure" and "Sonia's birthday" and excludes the
 * standing lessons, with no keyword list to maintain and nothing filtered by
 * topic (a friend's surprise party is notable, and shows).
 *
 * NOT the recurrence marker: these repeats are written as separate one-off
 * events by the Cowork job, so they carry no RRULE and no `::` id — frequency is
 * the only thing that distinguishes them.
 *
 * Returns the single soonest notable event on a future day, or null. `exclude`
 * carries the ids the agenda is already showing, so Up next is always additive —
 * it flags the next notable thing you are NOT already looking at, which is what
 * "keep an eye out" means. On a sparse day the rolling agenda reaches forward and
 * would otherwise show the same event twice.
 *
 * Known edge: a routine title that happens to fall only once inside the loaded
 * window would read as notable; a curated milestones feed (deep + sparse) is the
 * eventual fix, and would let this drop the heuristic entirely.
 */
export function selectUpNext(
  events: Entry[],
  now: Date,
  exclude: Set<string> = new Set(),
): Entry | null {
  const counts = new Map<string, number>();
  for (const e of events) counts.set(titleKey(e), (counts.get(titleKey(e)) ?? 0) + 1);

  const nowMs = now.getTime();
  const horizon = nowMs + UP_NEXT_DAYS * 86_400_000;

  return (
    events
      .filter((e) => e.starts_at && !exclude.has(e.id))
      .map((e) => ({ e, at: new Date(e.starts_at!) }))
      // A future DAY, not just a future instant: something later today is already
      // in the agenda's Today, and "up next" is the heads-up beyond today.
      .filter(
        ({ e, at }) =>
          at.getTime() > nowMs &&
          at.getTime() < horizon &&
          !isSameDay(at, now) &&
          (counts.get(titleKey(e)) ?? 0) < 2,
      )
      .sort((a, b) => a.at.getTime() - b.at.getTime())[0]?.e ?? null
  );
}
