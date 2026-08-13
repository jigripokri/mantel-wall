import { describe, it, expect } from "vitest";
import { selectAgenda, selectUpNext, agendaHeading, MAX_ROWS } from "./agenda";
import type { Entry } from "./types";

const NOW = new Date("2026-07-21T18:00:00Z"); // Tue 21 Jul, 11:00 PDT

let seq = 0;
function ev(startsAt: string, title: string, endsAt?: string): Entry {
  seq += 1;
  return {
    id: `e${seq}`,
    type: "event",
    source: "family",
    created_by: null,
    created_at: startsAt,
    updated_at: startsAt,
    starts_at: startsAt,
    ends_at: endsAt ?? null,
    due_at: null,
    expires_at: null,
    status: "active",
    color: null,
    external_id: `x${seq}`,
    pinned: false,
    sort_order: 0,
    payload: { title },
    media_key: null,
  };
}

const titles = (a: { rows: Entry[] }) => a.rows.map((r) => (r.payload as { title: string }).title);

describe("agenda selection (rolling horizon)", () => {
  it("fills the list from later days when today is sparse", () => {
    // The dominant real case: one event today, nothing else until Thursday.
    const agenda = selectAgenda(
      [
        ev("2026-07-22T01:15:00Z", "Swim"), // today 18:15 PDT
        ev("2026-07-23T03:15:00Z", "Taekwondo"), // Wed
        ev("2026-07-23T15:15:00Z", "Dentist"), // Thu 08:15 PDT
        ev("2026-07-24T02:00:00Z", "Later thing"),
      ],
      NOW,
    );
    expect(titles(agenda)).toEqual(["Swim", "Taekwondo", "Dentist"]);
    expect(agenda.hasToday).toBe(true);
    // Only one event today and it is shown, so nothing is "more today".
    expect(agenda.more).toBe(0);
  });

  it("reaches past an entirely empty day", () => {
    const agenda = selectAgenda(
      [ev("2026-07-25T15:30:00Z", "Taekwondo"), ev("2026-07-25T17:45:00Z", "Birthday")],
      NOW,
    );
    expect(titles(agenda)).toEqual(["Taekwondo", "Birthday"]);
    // Nothing today — the heading must say so rather than claim "Today".
    expect(agenda.hasToday).toBe(false);
  });

  it("counts '+ n more' against TODAY, not the whole week", () => {
    // Four today plus a busy rest-of-week. Counting the week would pin a large
    // permanent number to the wall.
    const agenda = selectAgenda(
      [
        ev("2026-07-21T19:00:00Z", "A"),
        ev("2026-07-21T20:00:00Z", "B"),
        ev("2026-07-21T21:00:00Z", "C"),
        ev("2026-07-21T22:00:00Z", "D"),
        ev("2026-07-23T19:00:00Z", "Later 1"),
        ev("2026-07-24T19:00:00Z", "Later 2"),
      ],
      NOW,
    );
    expect(agenda.rows).toHaveLength(MAX_ROWS);
    expect(agenda.more).toBe(1); // D, not the two later ones
  });

  it("keeps an event that has started but not ended", () => {
    const agenda = selectAgenda(
      [ev("2026-07-21T17:00:00Z", "In progress", "2026-07-21T20:00:00Z")],
      NOW,
    );
    expect(titles(agenda)).toEqual(["In progress"]);
    expect(agenda.hasToday).toBe(true);
  });

  it("drops an event that has already ended", () => {
    const agenda = selectAgenda(
      [ev("2026-07-21T10:00:00Z", "Over", "2026-07-21T11:00:00Z")],
      NOW,
    );
    expect(agenda.rows).toEqual([]);
    expect(agenda.hasToday).toBe(false);
  });

  it("does not reach beyond the lookahead window", () => {
    // 10 days out — past the horizon, so the wall says nothing rather than
    // presenting a planner.
    const agenda = selectAgenda([ev("2026-07-31T18:00:00Z", "Far future")], NOW);
    expect(agenda.rows).toEqual([]);
  });

  it("returns an empty agenda rather than throwing when there is nothing", () => {
    const agenda = selectAgenda([], NOW);
    expect(agenda).toEqual({ rows: [], more: 0, hasToday: false, allToday: false });
  });

  it("ignores entries with no start time", () => {
    const noStart = { ...ev("2026-07-22T01:00:00Z", "Untimed"), starts_at: null };
    const agenda = selectAgenda([noStart], NOW);
    expect(agenda.rows).toEqual([]);
  });
});

describe("agenda heading (honest about today vs ahead)", () => {
  it("says a bare Today only when every shown row is today", () => {
    const agenda = selectAgenda(
      [ev("2026-07-21T20:00:00Z", "A"), ev("2026-07-21T22:00:00Z", "B")], // both Jul 21 PDT
      NOW,
    );
    expect(agenda.allToday).toBe(true);
    expect(agendaHeading(agenda)).toBe("Today");
  });

  it("says 'Coming up' the moment the list rolls into a later day", () => {
    // Today + a later day: not all-today, so it must NOT say a bare "Today".
    const agenda = selectAgenda(
      [ev("2026-07-21T20:00:00Z", "Today thing"), ev("2026-07-23T20:00:00Z", "Later thing")],
      NOW,
    );
    expect(agenda.hasToday).toBe(true);
    expect(agenda.allToday).toBe(false);
    expect(agendaHeading(agenda)).toBe("Coming up");
  });

  it("says 'Coming up' when nothing shown is today", () => {
    const agenda = selectAgenda([ev("2026-07-24T20:00:00Z", "Future only")], NOW);
    expect(agenda.hasToday).toBe(false);
    expect(agendaHeading(agenda)).toBe("Coming up");
  });
});

describe("up next (next notable thing)", () => {
  const title = (e: { payload: unknown } | null) => (e?.payload as { title: string })?.title;

  it("picks the soonest non-repeating event, skipping routine repeats", () => {
    // Taekwondo repeats (routine); the birthday and orientation appear once —
    // this is exactly how the real calendar separates lessons from notable
    // one-offs, since the repeats carry no recurrence marker.
    const events = [
      ev("2026-07-22T01:00:00Z", "Taekwondo"),
      ev("2026-07-23T01:00:00Z", "Anvi's Birthday"),
      ev("2026-07-24T01:00:00Z", "Taekwondo"),
      ev("2026-07-26T01:00:00Z", "Taekwondo"),
      ev("2026-07-28T01:00:00Z", "School Orientation"),
    ];
    expect(title(selectUpNext(events, NOW))).toBe("Anvi's Birthday");
  });

  it("does not filter by topic — a friend's surprise party is notable and shows", () => {
    const events = [
      ev("2026-07-22T01:00:00Z", "Taekwondo"),
      ev("2026-07-23T01:00:00Z", "Taekwondo"),
      ev("2026-07-25T01:00:00Z", "Sonia's Surprise 40th"),
    ];
    expect(title(selectUpNext(events, NOW))).toBe("Sonia's Surprise 40th");
  });

  it("returns null when everything ahead is routine", () => {
    const events = [
      ev("2026-07-22T01:00:00Z", "Taekwondo"),
      ev("2026-07-23T01:00:00Z", "Taekwondo"),
      ev("2026-07-24T01:00:00Z", "Swim"),
      ev("2026-07-25T01:00:00Z", "Swim"),
    ];
    expect(selectUpNext(events, NOW)).toBeNull();
  });

  it("ignores notable events past the 21-day window", () => {
    expect(selectUpNext([ev("2026-08-20T01:00:00Z", "Diwali")], NOW)).toBeNull();
  });

  it("ignores events at or before now", () => {
    const events = [
      ev("2026-07-20T01:00:00Z", "Past Party"),
      ev("2026-07-25T01:00:00Z", "Future Party"),
    ];
    expect(title(selectUpNext(events, NOW))).toBe("Future Party");
  });

  it("skips something later TODAY — that's already the agenda's job", () => {
    // NOW is Jul 21 11:00 PDT. The dinner is 19:00 PDT the same day; up next is
    // the heads-up beyond today, so it should surface tomorrow's thing instead.
    const events = [
      ev("2026-07-22T02:00:00Z", "Dinner tonight"), // Jul 21 19:00 PDT — today
      ev("2026-07-23T01:00:00Z", "Birthday"), // Jul 22 — a future day
    ];
    expect(title(selectUpNext(events, NOW))).toBe("Birthday");
  });

  it("breaks ties by earliest start", () => {
    const events = [
      ev("2026-07-25T20:00:00Z", "Evening thing"),
      ev("2026-07-25T02:00:00Z", "Morning thing"),
    ];
    expect(title(selectUpNext(events, NOW))).toBe("Morning thing");
  });

  it("skips events the agenda is already showing, staying additive", () => {
    const shown = ev("2026-07-23T01:00:00Z", "Birthday");
    const beyond = ev("2026-07-26T01:00:00Z", "Orientation");
    // Without the exclusion it would pick the nearer Birthday; the agenda shows
    // that one, so up next should surface the next notable thing instead.
    expect(title(selectUpNext([shown, beyond], NOW))).toBe("Birthday");
    expect(title(selectUpNext([shown, beyond], NOW, new Set([shown.id])))).toBe("Orientation");
  });

  it("is case- and whitespace-insensitive when counting repeats", () => {
    const events = [
      ev("2026-07-22T01:00:00Z", "Taekwondo"),
      ev("2026-07-24T01:00:00Z", " taekwondo "),
      ev("2026-07-26T01:00:00Z", "TAEKWONDO"),
      ev("2026-07-27T01:00:00Z", "Dentist"),
    ];
    expect(title(selectUpNext(events, NOW))).toBe("Dentist");
  });
});
