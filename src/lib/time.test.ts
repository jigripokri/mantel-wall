import { describe, it, expect } from "vitest";
import {
  HOME_TZ,
  dayPart,
  greeting,
  isSameDay,
  fmtTime,
  fmtClock,
  fmtDayLabel,
  fmtPastDayLabel,
  homeDayNumber,
  startOfDay,
  countdownLabel,
} from "./time";

/**
 * These run under TZ=UTC and TZ=America/Los_Angeles (see vitest.config.ts). Every
 * assertion below must hold in BOTH — that is the guarantee that the wall reads
 * the same whether the Pi was flashed with a configured zone or left on the
 * Raspberry Pi OS UTC default.
 */
describe("wall time is pinned to the home zone", () => {
  it("defaults to the home the mantel lives in", () => {
    expect(HOME_TZ).toBe("America/Los_Angeles");
  });

  it("reads the hour in the home zone, not the host's", () => {
    // 12:00Z is 05:00 in the home zone — morning, even on a UTC host where a
    // naive getHours() would call it midday.
    expect(dayPart(new Date("2026-07-19T12:00:00Z"))).toBe("morning");
    expect(greeting(new Date("2026-07-19T12:00:00Z"))).toBe("Good morning");
    // 03:00Z is 20:00 the previous evening.
    expect(dayPart(new Date("2026-07-19T03:00:00Z"))).toBe("evening");
  });

  it("buckets days by the home zone across the UTC midnight boundary", () => {
    // Both instants fall on Jul 18 in the home zone; in UTC they straddle midnight
    // and a naive comparison would call them different days.
    const lateEvening = new Date("2026-07-19T03:00:00Z"); // Jul 18, 20:00 PDT
    const afternoon = new Date("2026-07-18T20:00:00Z"); // Jul 18, 13:00 PDT
    expect(isSameDay(lateEvening, afternoon)).toBe(true);

    const nextDay = new Date("2026-07-19T20:00:00Z"); // Jul 19, 13:00 PDT
    expect(isSameDay(lateEvening, nextDay)).toBe(false);
  });

  it("formats clock times in the home zone", () => {
    expect(fmtTime("2026-07-19T12:00:00Z")).toBe("5:00 AM");
    expect(fmtTime("2026-07-19T23:00:00Z")).toBe("4:00 PM");
    expect(fmtTime(null)).toBe("");
  });

  it("anchors startOfDay to home midnight", () => {
    expect(startOfDay(new Date("2026-07-19T12:00:00Z")).toISOString()).toBe(
      "2026-07-19T07:00:00.000Z",
    );
    // An instant that is already the next day in UTC still belongs to Jul 18.
    expect(startOfDay(new Date("2026-07-19T03:00:00Z")).toISOString()).toBe(
      "2026-07-18T07:00:00.000Z",
    );
  });

  it("labels Today and Tomorrow by home calendar day", () => {
    const now = new Date("2026-07-19T12:00:00Z"); // Jul 19, 05:00 PDT
    expect(fmtDayLabel(now, new Date("2026-07-19T23:00:00Z"))).toBe("Today");
    expect(fmtDayLabel(now, new Date("2026-07-20T23:00:00Z"))).toBe("Tomorrow");
    expect(fmtDayLabel(now, new Date("2026-07-22T23:00:00Z"))).toBe("Wednesday");
  });

  it("counts down to a future day in home-zone days", () => {
    const now = new Date("2026-07-21T18:00:00Z"); // Jul 21, 11:00 PDT
    expect(countdownLabel(now, new Date("2026-07-21T23:00:00Z"))).toBe("Today");
    expect(countdownLabel(now, new Date("2026-07-22T20:00:00Z"))).toBe("Tomorrow");
    expect(countdownLabel(now, new Date("2026-07-25T20:00:00Z"))).toBe("in 4 days");
    expect(countdownLabel(now, new Date("2026-08-06T20:00:00Z"))).toBe("in 2 weeks");
  });

  it("heads past days with Today / Yesterday / a dated weekday", () => {
    const now = new Date("2026-07-26T18:00:00Z"); // Jul 26, 11:00 PDT
    // 03:00Z is still Jul 25 in the home zone — a bedtime star files under
    // Yesterday, not Today, even on a UTC host.
    expect(fmtPastDayLabel(now, new Date("2026-07-26T03:00:00Z"))).toBe("Yesterday");
    expect(fmtPastDayLabel(now, new Date("2026-07-26T20:00:00Z"))).toBe("Today");
    expect(fmtPastDayLabel(now, new Date("2026-07-20T20:00:00Z"))).toBe("Mon, Jul 20");
  });

  it("keys a day by the home zone, so history groups the same on any host", () => {
    // Two instants either side of UTC midnight, both Jul 25 in the home zone.
    expect(homeDayNumber(new Date("2026-07-26T03:00:00Z"))).toBe(
      homeDayNumber(new Date("2026-07-25T20:00:00Z")),
    );
    expect(homeDayNumber(new Date("2026-07-26T18:00:00Z"))).not.toBe(
      homeDayNumber(new Date("2026-07-25T20:00:00Z")),
    );
  });

  it("counts calendar days across a DST transition", () => {
    // Nov 1 2026 is the PDT->PST fallback: those two local midnights are 25
    // hours apart, so a fixed 86_400_000 divisor would round to the wrong day.
    const before = new Date("2026-10-31T18:00:00Z"); // Oct 31, 11:00 PDT
    const after = new Date("2026-11-01T19:00:00Z"); // Nov 1, 11:00 PST
    expect(fmtDayLabel(before, after)).toBe("Tomorrow");
  });
});

describe("the wall clock", () => {
  // The clock was the last thing on the wall still read from the HOST zone
  // while the greeting, date line and every event time used HOME_TZ. On a Pi
  // flashed without raspi-config that put "GOOD MORNING" over an afternoon
  // clock. These run under both TZ=UTC and TZ=America/Los_Angeles, so a
  // regression fails in exactly one of the two runs.
  const evening = new Date("2026-08-14T01:12:00Z"); // 6:12 PM in Los Angeles

  it("reads in the home zone, whatever zone the host is in", () => {
    const { clock } = fmtClock(evening);
    const expected = evening.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
      timeZone: HOME_TZ,
    });
    expect(expected.startsWith(clock)).toBe(true);
    expect(clock).not.toBe("1:12"); // the UTC reading, i.e. the bug
  });

  it("agrees with the greeting beside it", () => {
    // The two are rendered inches apart; disagreeing is the visible symptom.
    expect(greeting(evening)).toBe("Good evening");
    expect(dayPart(evening)).toBe("evening");
  });

  it("hands back the meridiem split off, and tolerates not having one", () => {
    const { clock, meridiem } = fmtClock(evening);
    expect(clock).not.toContain(" ");
    // Empty on a 24-hour locale — the layouts render it conditionally.
    if (meridiem) expect(["AM", "PM"]).toContain(meridiem);
  });
});

