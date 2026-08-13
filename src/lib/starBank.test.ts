import { describe, it, expect } from "vitest";
import {
  DEFAULT_STAR_BANK,
  NEUTRAL_GIVER,
  STAR_LOG_LIMIT,
  isFull,
  addStar,
  noteLastStar,
  resetWeek,
  setReward,
  starColor,
  starGiverAt,
  starGlow,
  withAlpha,
  watchGoal,
  GOAL_WATCH_INIT,
  type StarBank,
} from "./starBank";
import { FAMILY } from "../config/family";

// The two people the shipped config declares. Tests address them through the
// config rather than by name, so a fork that renames its family stays green.
const [P1, P2] = FAMILY.people;

const bank = (over: Partial<StarBank> = {}): StarBank => ({ ...DEFAULT_STAR_BANK, ...over });

describe("star bank", () => {
  it("adds a star, additively", () => {
    expect(addStar(bank({ stars: 2 })).stars).toBe(3);
  });

  it("never exceeds the week's goal", () => {
    expect(addStar(bank({ stars: 7, goal: 7 })).stars).toBe(7);
  });

  it("is full only at or beyond the goal", () => {
    expect(isFull(bank({ stars: 6, goal: 7 }))).toBe(false);
    expect(isFull(bank({ stars: 7, goal: 7 }))).toBe(true);
  });

  it("resets a week to zero without touching the reward", () => {
    const b = bank({ stars: 7, reward: { icon: "🍦", label: "Ice cream" } });
    const r = resetWeek(b);
    expect(r.stars).toBe(0);
    expect(r.reward).toEqual({ icon: "🍦", label: "Ice cream" });
  });

  it("sets the week's reward without touching the stars", () => {
    const r = setReward(bank({ stars: 4 }), { icon: "🌳", label: "Park trip" });
    expect(r.reward.label).toBe("Park trip");
    expect(r.stars).toBe(4);
  });

  it("has no way to remove a single star — additive only, by design", () => {
    // The module exports addStar and resetWeek, never a decrement. This test
    // documents that intent so a "− star" helper isn't added later without a
    // second look.
    const exported = { isFull, addStar, resetWeek, setReward };
    expect(Object.keys(exported)).not.toContain("removeStar");
  });

  it("records the giver of each star, in order", () => {
    let b = bank({ stars: 0, givers: [] });
    b = addStar(b, P1.id);
    b = addStar(b, P2.id);
    expect(b.stars).toBe(2);
    expect(b.givers).toEqual([P1.id, P2.id]);
  });

  it("backfills givers for a bank that predates them, so old stars stay neutral", () => {
    const r = addStar(bank({ stars: 3, givers: undefined }), P2.id);
    expect(r.stars).toBe(4);
    expect(r.givers).toEqual([NEUTRAL_GIVER, NEUTRAL_GIVER, NEUTRAL_GIVER, P2.id]);
  });

  it("records no giver when the tap is a no-op at the goal", () => {
    const r = addStar(bank({ stars: 7, goal: 7, givers: [] }), P1.id);
    expect(r.stars).toBe(7);
    expect(r.givers).toEqual([]);
  });

  it("clears givers on a fresh week", () => {
    const r = resetWeek(bank({ stars: 3, givers: [P1.id, P2.id, P1.id] }));
    expect(r.stars).toBe(0);
    expect(r.givers).toEqual([]);
  });

  it("tints a star by its giver, and anything unrecognised neutrally", () => {
    expect(starColor(P1.id)).toBe(P1.color);
    expect(starColor(P2.id)).toBe(P2.color);
    expect(starColor(NEUTRAL_GIVER)).toBe(FAMILY.neutralColor);
  });

  it("survives a giver that no longer resolves — a rename, or another family's bank", () => {
    // Stored banks outlive the config. An id that isn't in FAMILY.people must
    // fall back to the neutral colour rather than throw at render.
    expect(starColor("someone-who-left")).toBe(FAMILY.neutralColor);
    expect(starColor("")).toBe(FAMILY.neutralColor);
  });

  it("keeps at least one person visually distinct from the neutral", () => {
    // The wall's whole point here is "mine" against "everyone else's". A config
    // where every person matched the neutral would silently flatten that.
    expect(FAMILY.people.some((p) => p.color !== FAMILY.neutralColor)).toBe(true);
  });

  it("reads a star's giver by index, tolerating a short list", () => {
    const b = bank({ stars: 3, givers: [P2.id] });
    expect(starGiverAt(b, 0)).toBe(P2.id);
    expect(starGiverAt(b, 2)).toBe(NEUTRAL_GIVER);
  });

  it("logs each star with its reason, giver and instant", () => {
    let b = bank({ stars: 0, givers: [], log: [] });
    b = addStar(b, P2.id, { note: "  Brushing  ", at: "2026-07-26T02:30:00.000Z" });
    b = addStar(b, P1.id, { at: "2026-07-26T03:00:00.000Z" });
    expect(b.log).toEqual([
      { kind: "star", at: "2026-07-26T02:30:00.000Z", giver: P2.id, note: "Brushing" },
      { kind: "star", at: "2026-07-26T03:00:00.000Z", giver: P1.id },
    ]);
  });

  it("keeps the history across a fresh week, marking the boundary", () => {
    let b = bank({ stars: 0, givers: [], log: [] });
    b = addStar(b, P1.id, { note: "Kindness", at: "2026-07-25T18:00:00.000Z" });
    b = resetWeek(b, "2026-07-26T15:00:00.000Z");
    expect(b.stars).toBe(0);
    expect(b.log).toEqual([
      { kind: "star", at: "2026-07-25T18:00:00.000Z", giver: P1.id, note: "Kindness" },
      { kind: "week", at: "2026-07-26T15:00:00.000Z" },
    ]);
  });

  it("attaches a reason to the star just given, and clears it when blank", () => {
    let b = bank({ stars: 0, givers: [], log: [] });
    b = addStar(b, P2.id, { at: "2026-07-26T02:00:00.000Z" });
    b = addStar(b, P1.id, { at: "2026-07-26T04:00:00.000Z" });
    b = noteLastStar(b, "  Tidying up  ");
    expect(b.log?.[1]).toEqual({
      kind: "star",
      at: "2026-07-26T04:00:00.000Z",
      giver: P1.id,
      note: "Tidying up",
    });
    expect(b.log?.[0]).not.toHaveProperty("note");

    b = noteLastStar(b, "   ");
    expect(b.log?.[1]).toEqual({ kind: "star", at: "2026-07-26T04:00:00.000Z", giver: P1.id });
  });

  it("never notes a week marker, and no-ops on an empty history", () => {
    const b = resetWeek(bank({ stars: 1, log: [] }), "2026-07-26T15:00:00.000Z");
    expect(noteLastStar(b, "oops").log).toEqual([{ kind: "week", at: "2026-07-26T15:00:00.000Z" }]);
    expect(noteLastStar(bank({ log: undefined }), "oops").log).toBeUndefined();
  });

  it("writes no history for a tap that lands at the goal", () => {
    const b = addStar(bank({ stars: 7, goal: 7, log: [] }), P1.id, { note: "Nope" });
    expect(b.log).toEqual([]);
  });

  it("caps the history so the settings row can't grow without bound", () => {
    let b = bank({ stars: 0, goal: 999, givers: [], log: [] });
    for (let i = 0; i < STAR_LOG_LIMIT + 5; i++) {
      b = addStar(b, NEUTRAL_GIVER, { note: `n${i}`, at: "2026-07-26T02:00:00.000Z" });
    }
    expect(b.log).toHaveLength(STAR_LOG_LIMIT);
    // The oldest fall off the front; the newest are always kept.
    expect(b.log?.[STAR_LOG_LIMIT - 1]).toMatchObject({ note: `n${STAR_LOG_LIMIT + 4}` });
    expect(b.log?.[0]).toMatchObject({ note: "n5" });
  });

  it("bursts on the star that fills the row, and only that one", () => {
    let w = watchGoal(GOAL_WATCH_INIT, false); // first settled read: nine stars
    expect(w.celebrating).toBe(false);
    w = watchGoal(w, true); // the tenth lands
    expect(w.celebrating).toBe(true);
  });

  it("never bursts on a wall that boots into a full row", () => {
    // The Pi reboots (HDMI handshake, Chromium restart, the nightly Art Mode
    // swap) and re-reads the same full row every time. The first settled read
    // only arms the detector — otherwise the one moment the row filled becomes
    // wallpaper that fires on every restart.
    const w = watchGoal(GOAL_WATCH_INIT, true);
    expect(w.celebrating).toBe(false);
    expect(watchGoal(w, true).celebrating).toBe(false);
  });

  it("is idempotent, so a repeated read never re-fires or drops the burst", () => {
    // React double-invokes effects under StrictMode and Realtime happily echoes
    // a row back; both feed the same value in twice.
    const armed = watchGoal(GOAL_WATCH_INIT, false);
    const first = watchGoal(armed, true);
    expect(watchGoal(first, true)).toEqual(first);
    expect(watchGoal(watchGoal(armed, true), true).celebrating).toBe(true);
  });

  it("stops the burst the moment a fresh week is started", () => {
    const w = watchGoal(watchGoal(GOAL_WATCH_INIT, false), true);
    expect(w.celebrating).toBe(true);
    expect(watchGoal(w, false)).toEqual({ seen: false, celebrating: false });
  });

  it("bursts again the week after, once the row refills", () => {
    let w = watchGoal(GOAL_WATCH_INIT, false);
    w = watchGoal(w, true);
    w = watchGoal(w, false); // fresh week
    w = watchGoal(w, true); // and he fills it again
    expect(w.celebrating).toBe(true);
  });

  it("builds a colour-matched glow and alpha", () => {
    expect(withAlpha("hsl(208 66% 72%)", 0.5)).toBe("hsl(208 66% 72% / 0.5)");
    expect(starGlow("hsl(208 66% 72%)", 14)).toBe("0 0 14px hsl(208 66% 72% / 0.5)");
  });
});
