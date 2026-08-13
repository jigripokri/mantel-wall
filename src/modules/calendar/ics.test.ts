import { describe, it, expect } from "vitest";
import {
  parseIcs,
  looksLikeIcs,
  assertUniqueSources,
  splitPerson,
  unknownPersonPrefixes,
  type CalendarFeed,
  type ParseOptions,
  type PeopleMap,
} from "./ics";
import personIcs from "./__fixtures__/person-prefixes.ics?raw";
import recurringIcs from "./__fixtures__/recurring.ics?raw";
import allDayIcs from "./__fixtures__/all-day.ics?raw";
import noVtimezoneIcs from "./__fixtures__/no-vtimezone.ics?raw";
import durationIcs from "./__fixtures__/duration-and-cancelled.ics?raw";

const NOW = new Date("2026-07-19T12:00:00Z");

const OPTS: ParseOptions = {
  windowStart: new Date(NOW.getTime() - 7 * 86_400_000), // 2026-07-12T12:00:00Z
  windowEnd: new Date(NOW.getTime() + 21 * 86_400_000), // 2026-08-09T12:00:00Z
  homeTz: "America/Los_Angeles",
};

const FEED: CalendarFeed = {
  url: "https://example.test/family.ics",
  source: "test_cal",
  color: "hsl(42 60% 62%)",
};

const byId = (rows: { external_id: string }[]) => rows.map((r) => r.external_id).sort();

describe("host timezone pinning", () => {
  // If this fails, the two vitest projects are NOT actually running under
  // different zones and every divergence assertion below is vacuous.
  it("actually applies the project's TZ to the runtime", () => {
    expect(process.env.TZ).toBeTruthy();
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(process.env.TZ);
  });
});

describe("recurrence expansion", () => {
  const rows = parseIcs(recurringIcs, FEED, OPTS);

  it("expands an RRULE into concrete in-window occurrences only", () => {
    // Mondays 16:00 PT from 2026-07-06. Jul 6 predates the window; Aug 10 is
    // past it; Jul 20 is EXDATE'd. Leaves Jul 13, Jul 27, Aug 3.
    expect(rows).toHaveLength(3);
  });

  it("honours EXDATE", () => {
    expect(byId(rows)).not.toContain("soccer-practice@mantel.test::20260720T160000");
  });

  it("keys external_id on RECURRENCE-ID, not occurrence start", () => {
    // The Jul 27 instance was dragged 16:00 -> 18:00. Its identity must remain
    // the ORIGINAL 16:00 recurrence id, or every such edit orphans a row.
    expect(byId(rows)).toEqual([
      "soccer-practice@mantel.test::20260713T160000",
      "soccer-practice@mantel.test::20260727T160000",
      "soccer-practice@mantel.test::20260803T160000",
    ]);
  });

  it("applies the RECURRENCE-ID override's new time and title", () => {
    const overridden = rows.find((r) => r.external_id.endsWith("::20260727T160000"));
    expect(overridden?.starts_at).toBe("2026-07-28T01:00:00.000Z"); // 18:00 PDT
    expect(overridden?.payload.title).toBe("Soccer practice (late start)");
  });

  it("resolves VTIMEZONE offsets (16:00 PDT = 23:00Z)", () => {
    const first = rows.find((r) => r.external_id.endsWith("::20260713T160000"));
    expect(first?.starts_at).toBe("2026-07-13T23:00:00.000Z");
    expect(first?.ends_at).toBe("2026-07-14T00:30:00.000Z");
  });

  it("emits no duplicate external_ids", () => {
    expect(new Set(byId(rows)).size).toBe(rows.length);
  });
});

describe("all-day events", () => {
  const rows = parseIcs(allDayIcs, FEED, OPTS);

  it("anchors date-only values to HOME midnight, not UTC midnight", () => {
    // The bug this replaces: UTC midnight rendered as 5pm the PREVIOUS day.
    const noSchool = rows.find((r) => r.external_id === "no-school@mantel.test");
    expect(noSchool?.starts_at).toBe("2026-07-20T07:00:00.000Z"); // 00:00 PDT
    expect(noSchool?.payload.allDay).toBe(true);
    expect(noSchool?.payload.date).toBe("2026-07-20");
  });

  it("keeps the exclusive DTEND as the true end instant", () => {
    // A one-day event on the 20th ends at midnight on the 21st. Shifting this
    // back a day would make `ends_at >= now` false all through the 20th and the
    // event would never appear.
    const noSchool = rows.find((r) => r.external_id === "no-school@mantel.test");
    expect(noSchool?.ends_at).toBe("2026-07-21T07:00:00.000Z");
  });

  it("keeps an in-progress multi-day event alive", () => {
    const trip = rows.find((r) => r.external_id === "tahoe-trip@mantel.test");
    expect(trip?.starts_at).toBe("2026-07-15T07:00:00.000Z");
    expect(trip?.ends_at).toBe("2026-07-22T07:00:00.000Z");
    // started before `now`, ends after it
    expect(new Date(trip!.starts_at).getTime()).toBeLessThan(NOW.getTime());
    expect(new Date(trip!.ends_at!).getTime()).toBeGreaterThan(NOW.getTime());
  });
});

describe("timezone resolution without VTIMEZONE (the divergence cases)", () => {
  const rows = parseIcs(noVtimezoneIcs, FEED, OPTS);
  const find = (id: string) => rows.find((r) => r.external_id === id);

  it("maps Outlook-style zone names to IANA", () => {
    // TZID="Pacific Standard Time", no VTIMEZONE. 19:00 PT -> 02:00Z next day.
    expect(find("back-to-school@mantel.test")?.starts_at).toBe("2026-07-23T02:00:00.000Z");
  });

  it("resolves floating times against HOME_TZ, never runtime-local", () => {
    // No TZID at all. Under TZ=UTC a naive parser yields 09:00Z; this must be
    // 16:00Z in BOTH projects.
    expect(find("floating-meeting@mantel.test")?.starts_at).toBe("2026-07-23T16:00:00.000Z");
  });

  it("leaves explicit UTC values untouched", () => {
    expect(find("utc-anchored@mantel.test")?.starts_at).toBe("2026-07-24T17:00:00.000Z");
  });
});

describe("DTEND alternatives and status", () => {
  const rows = parseIcs(durationIcs, FEED, OPTS);

  it("derives ends_at from DURATION when DTEND is absent", () => {
    // Without this, ends_at is null and TvWall's `ends_at ?? starts_at` filter
    // drops the event the instant it starts.
    const dentist = rows.find((r) => r.external_id === "dentist@mantel.test");
    expect(dentist?.starts_at).toBe("2026-07-22T21:30:00.000Z");
    expect(dentist?.ends_at).toBe("2026-07-22T22:15:00.000Z");
  });

  it("skips STATUS:CANCELLED events", () => {
    expect(byId(rows)).not.toContain("cancelled-thing@mantel.test");
    expect(rows).toHaveLength(1);
  });
});

describe("row shape", () => {
  it("always emits every key with an explicit null", () => {
    // PostgREST unions keys across a batch; an omitted key becomes a NULL write
    // on rows that had a value.
    for (const row of parseIcs(recurringIcs, FEED, OPTS)) {
      for (const key of ["type", "source", "external_id", "starts_at", "ends_at", "color", "status", "payload"]) {
        expect(row).toHaveProperty(key);
      }
      expect(row.payload).toHaveProperty("date");
      expect(row.source).toBe(FEED.source);
      expect(row.color).toBe(FEED.color);
      expect(row.status).toBe("active");
    }
  });
});

describe("iteration caps", () => {
  it("terminates on a pathological rule without hanging", () => {
    const runaway = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Mantel Test//Runaway//EN",
      "BEGIN:VEVENT",
      "UID:runaway@mantel.test",
      "DTSTAMP:20090101T000000Z",
      "DTSTART:20090101T000000Z",
      "DTEND:20090101T000100Z",
      "RRULE:FREQ=SECONDLY",
      "SUMMARY:Runaway",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const started = Date.now();
    const rows = parseIcs(runaway, FEED, { ...OPTS, maxIterationsPerEvent: 500 });
    expect(Date.now() - started).toBeLessThan(5_000);
    // A 2009 SECONDLY rule cannot reach a 2026 window within the cap.
    expect(rows).toHaveLength(0);
  });
});

describe("person prefixes", () => {
  const PEOPLE: PeopleMap = {
    Alex: "hsl(42 48% 62%)",
    Sam: "hsl(310 16% 68%)",
    Robin: "hsl(210 28% 68%)",
    Family: "hsl(115 18% 60%)",
  };
  const rows = parseIcs(personIcs, FEED, { ...OPTS, people: PEOPLE });
  const find = (id: string) => rows.find((r) => r.external_id === id);

  it("strips a recognised prefix and takes that person's colour", () => {
    const r = find("known-prefix@mantel.test");
    expect(r?.payload.title).toBe("Swim class");
    expect(r?.payload.person).toBe("Alex");
    expect(r?.color).toBe(PEOPLE.Alex);
  });

  it("matches case-insensitively but stores the canonical spelling", () => {
    // The feed says "sam:", the wall should say "Sam".
    const r = find("lowercase-prefix@mantel.test");
    expect(r?.payload.title).toBe("Taekwondo");
    expect(r?.payload.person).toBe("Sam");
    expect(r?.color).toBe(PEOPLE.Sam);
  });

  it("treats a group name like any other entry in the map", () => {
    const r = find("group-prefix@mantel.test");
    expect(r?.payload.title).toBe("Leo's 5th birthday");
    expect(r?.payload.person).toBe("Family");
    expect(r?.color).toBe(PEOPLE.Family);
  });

  it("NEVER strips an unrecognised prefix", () => {
    // The whole reason this is allowlist-driven: "Dentist: follow-up
    // appointment" must not silently become "follow-up appointment".
    const r = find("unknown-prefix@mantel.test");
    expect(r?.payload.title).toBe("Dentist: follow-up appointment");
    expect(r?.payload.person).toBeNull();
    expect(r?.color).toBe(FEED.color);
  });

  it("leaves a typo'd name intact rather than guessing", () => {
    const r = find("typo-prefix@mantel.test");
    expect(r?.payload.title).toBe("Kav: Swim class");
    expect(r?.payload.person).toBeNull();
  });

  it("only consumes the first colon", () => {
    const r = find("second-colon@mantel.test");
    expect(r?.payload.title).toBe("Swim: level 3");
    expect(r?.payload.person).toBe("Alex");
  });

  it("leaves an unprefixed title alone", () => {
    const r = find("no-prefix@mantel.test");
    expect(r?.payload.title).toBe("FIFA World Cup Final");
    expect(r?.payload.person).toBeNull();
    expect(r?.color).toBe(FEED.color);
  });

  it("reports unrecognised prefixes so a typo surfaces", () => {
    const unknown = unknownPersonPrefixes(rows, PEOPLE);
    expect(unknown).toContain("Kav");
    expect(unknown).toContain("Dentist");
    expect(unknown).not.toContain("Alex");
  });

  it("does nothing at all when PEOPLE is unset", () => {
    const bare = parseIcs(personIcs, FEED, OPTS);
    const r = bare.find((x) => x.external_id === "known-prefix@mantel.test");
    expect(r?.payload.title).toBe("Alex: Swim class");
    expect(r?.payload.person).toBeNull();
  });

  it("splitPerson handles the edges directly", () => {
    expect(splitPerson("Alex:Swim", PEOPLE)).toEqual({
      person: null,
      title: "Alex:Swim",
    }); // needs whitespace after the colon
    expect(splitPerson("  Alex:   Swim class  ", PEOPLE).title).toBe("Swim class");
    expect(splitPerson(":leading colon", PEOPLE).person).toBeNull();
    expect(splitPerson("A very long pretend name that is not real: thing", PEOPLE).person).toBeNull();
    expect(splitPerson("", PEOPLE).title).toBe("(untitled)");
  });
});

/**
 * Conformance with MANTEL EVENT TITLE CONVENTION v2 — the grammar the Cowork
 * batch job writes. This suite is the contract between that job and ingest; if
 * the convention is bumped past v1, these are the tests to change first.
 */
describe("title convention v2 conformance", () => {
  const PEOPLE: PeopleMap = {
    Alex: "p1",
    Sam: "p2",
    Robin: "p3",
    Family: "shared",
  };
  const split = (s: string) => splitPerson(s, PEOPLE);

  it("§2 splits on the first colon+space and keys off the prefix token", () => {
    expect(split("Alex: Swim")).toEqual({ person: "Alex", title: "Swim" });
    expect(split("Family: Beach Day")).toEqual({ person: "Family", title: "Beach Day" });
    expect(split("Robin: Airport Run")).toEqual({ person: "Robin", title: "Airport Run" });
  });

  it("§2 matches case-insensitively", () => {
    expect(split("alex: Swim").person).toBe("Alex");
    expect(split("SAM: Taekwondo").person).toBe("Sam");
  });

  it("§3 leaves an unprefixed title whole, with no person", () => {
    // The convention says self-explanatory events deliberately carry no prefix.
    expect(split("Leo's 5th Birthday")).toEqual({ person: null, title: "Leo's 5th Birthday" });
    expect(split("FIFA World Cup Final")).toEqual({ person: null, title: "FIFA World Cup Final" });
  });

  it("§4 never splits on a colon that is not followed by a space", () => {
    expect(split("Standup 6:30")).toEqual({ person: null, title: "Standup 6:30" });
    expect(split("Alex: Swim 6:30")).toEqual({ person: "Alex", title: "Swim 6:30" });
    // A colon-space later in the descriptor must not be the split point once a
    // valid prefix has already been consumed.
    expect(split("Alex: Swim: Level 3")).toEqual({ person: "Alex", title: "Swim: Level 3" });
    // And a 6:30 BEFORE the first colon-space must not become a prefix.
    expect(split("Meeting at 6:30: notes").person).toBeNull();
  });

  it("§5 never infers a person from descriptor text", () => {
    // "Alex" appears, but not as a prefix — must stay unattributed.
    expect(split("Drop Alex at school")).toEqual({
      person: null,
      title: "Drop Alex at school",
    });
    expect(split("Birthday party for Sam").person).toBeNull();
  });

  it("§FORWARD-COMPAT renders an unknown prefix as neutral without erroring", () => {
    expect(split("Grandma: Visit")).toEqual({ person: null, title: "Grandma: Visit" });
    expect(split("Kav: Swim")).toEqual({ person: null, title: "Kav: Swim" });
    expect(() => split("::::")).not.toThrow();
    expect(() => split("")).not.toThrow();
  });

  it("§FORWARD-COMPAT admits a new person by config alone", () => {
    const extended: PeopleMap = { ...PEOPLE, Grandma: "p4" };
    expect(splitPerson("Grandma: Visit", extended)).toEqual({
      person: "Grandma",
      title: "Visit",
    });
  });
});

describe("feed guards", () => {
  it("rejects a body that is not an ICS document", () => {
    // Revoked Google/iCloud secret URLs return 200 with an HTML login page.
    expect(looksLikeIcs("<!doctype html><html><body>Sign in</body></html>")).toBe(false);
    expect(looksLikeIcs("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true);
    expect(looksLikeIcs("\n  BEGIN:VCALENDAR\n")).toBe(true);
  });

  it("rejects duplicate feed sources", () => {
    const dup: CalendarFeed[] = [
      { url: "a", source: "google_cal", color: "x" },
      { url: "b", source: "google_cal", color: "y" },
    ];
    expect(() => assertUniqueSources(dup)).toThrow(/duplicate source/);
    expect(() => assertUniqueSources([dup[0]])).not.toThrow();
  });
});
