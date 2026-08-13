/**
 * The star bank — a research-shaped reward system. Stars are a single,
 * behaviour-agnostic currency: a parent taps one for whatever they decide earns
 * it that day (brushing, tidying, kindness), pairing it with immediate specific
 * praise. Fill the week's row and the child earns the reward set for that week.
 *
 * Whose bank it is, and who may tint a star, come from `src/config/family.ts`.
 *
 * Guardrails baked into the shape:
 *   - Additive within a week. `addStar` only goes up; there is no "remove a
 *     star" (that's punishment, and it backfires). A deliberate `resetWeek` is
 *     the only clear.
 *   - Small, weekly reward chosen from a short icon menu — experiences over
 *     stuff, which the evidence favours.
 *   - Designed to fade: keep it to one currency and swap what earns stars as
 *     habits form, rather than accumulating a wall of obligations.
 *
 * Stored as an `app_settings` row (key `star_bank`) — no new table; the family
 * write path from 0006 already covers it.
 */
import { FAMILY, personById } from "../config/family";

export type StarReward = { icon: string; label: string };

/**
 * Who tapped the star — a `Person.id` from src/config/family.ts, or
 * NEUTRAL_GIVER. Used only to colour it, never to decide anything: RLS is what
 * says who may write a star.
 *
 * Deliberately a plain string rather than a union of the configured ids. Ids
 * that no longer resolve — someone renamed, someone removed, a fork that
 * inherited another family's stored bank — must degrade to the neutral colour
 * rather than fail to typecheck or throw at render.
 */
export type StarGiver = string;

/** Stars from an unrecognised signer, from mock mode, and from banks written
 *  before the giver was recorded. The literal is stored in `app_settings`, so
 *  it is a wire value — don't rename it. */
export const NEUTRAL_GIVER = "other";

/**
 * One line of the history. Stars carry the "why" — the specific praise, written
 * down — and a fresh week leaves a marker so the log reads as weeks rather than
 * one undifferentiated pile. `at` is an ISO instant (UTC); it is formatted in
 * the home zone at render time, never in whatever zone the phone is set to.
 */
export type StarEvent =
  | { kind: "star"; at: string; giver: StarGiver; note?: string }
  | { kind: "week"; at: string };

/** The log rides along in the same `app_settings` row, so it needs a ceiling.
 *  Two hundred events is roughly half a year of weeks — well past what anyone
 *  scrolls, and small enough that the row stays a few KB. */
export const STAR_LOG_LIMIT = 200;

export type StarBank = {
  name: string;
  stars: number;
  /** One entry per star, in the order given, naming who gave it (for colour).
   *  May be shorter than `stars` for banks written before this field existed —
   *  those leading stars fall back to the neutral gold. */
  givers?: StarGiver[];
  /** Every star ever given, oldest first, surviving `resetWeek` — this is the
   *  history. Absent on banks written before it existed. */
  log?: StarEvent[];
  goal: number;
  reward: StarReward;
};

export const DEFAULT_STAR_BANK: StarBank = {
  name: FAMILY.starBank.childName,
  stars: 0,
  givers: [],
  log: [],
  goal: FAMILY.starBank.goal,
  reward: { icon: "🎬", label: "Movie night" },
};

/** The reward menu, grouped for the phone picker (companion design 1f). Swap
 *  these for whatever your family actually wants; the groups just help fifteen
 *  scan on a phone. The wall shows only the chosen reward's icon, so each icon
 *  must read alone. */
export const REWARD_GROUPS: { name: string; items: StarReward[] }[] = [
  {
    name: "Out & about",
    items: [
      { icon: "🥾", label: "Hike" },
      { icon: "🏊", label: "Pool time" },
      { icon: "🚲", label: "Biking trip" },
      { icon: "💦", label: "Sprinkler party" },
      { icon: "🤸", label: "Sky Zone trampoline" },
      { icon: "🦁", label: "Zoo day" },
      { icon: "⛺", label: "Camping night" },
    ],
  },
  {
    name: "At home",
    items: [
      { icon: "🕯️", label: "Candle making" },
      { icon: "🔬", label: "Science experiment" },
      { icon: "🧁", label: "Bake together" },
      { icon: "🎲", label: "Family game night" },
      { icon: "📖", label: "Extra bedtime stories" },
      { icon: "🎬", label: "Movie night" },
    ],
  },
  {
    name: "Treats",
    items: [
      { icon: "🍦", label: "Ice cream" },
      { icon: "🍕", label: "Pick dinner" },
    ],
  },
];

/** Flat view of the same fifteen, for anything that doesn't care about groups. */
export const REWARD_PRESETS: StarReward[] = REWARD_GROUPS.flatMap((g) => g.items);

/** Fallback icon when a custom reward is set with a title but no emoji. */
export const CUSTOM_REWARD_ICON = "🎁";

/** The colour a star is tinted, so it reads as a warm hand-placed mark rather
 *  than a status light. People and their colours come from the config; an id
 *  that doesn't resolve gets the neutral colour. Two people sharing a colour is
 *  fine — the distinction that matters across a room is "one person's" against
 *  "everyone else's", not a full key. */
export const starColor = (giver: StarGiver): string =>
  personById(giver)?.color ?? FAMILY.neutralColor;

/** The giver of the i-th star, tolerating a `givers` list shorter than `stars`. */
export const starGiverAt = (b: StarBank, i: number): StarGiver => b.givers?.[i] ?? NEUTRAL_GIVER;

/** Add an alpha channel to a space-separated hsl() colour. */
export const withAlpha = (color: string, a: number): string => color.replace(/\)\s*$/, ` / ${a})`);

/** A soft halo in the star's own colour, for the earned glyphs. */
export const starGlow = (color: string, px = 14): string => `0 0 ${px}px ${withAlpha(color, 0.5)}`;

export const isFull = (b: StarBank): boolean => b.stars >= b.goal;

/** Pad `givers` up to the current star count with the neutral marker, so a bank
 *  written before givers existed keeps its old stars gold; only new ones tint. */
const padGivers = (b: StarBank): StarGiver[] => {
  const g = b.givers ?? [];
  return g.length >= b.stars
    ? g.slice(0, b.stars)
    : [...g, ...(Array(b.stars - g.length).fill(NEUTRAL_GIVER) as StarGiver[])];
};

/** Append to the history, keeping only the most recent `STAR_LOG_LIMIT`. */
const appendLog = (b: StarBank, e: StarEvent): StarEvent[] =>
  [...(b.log ?? []), e].slice(-STAR_LOG_LIMIT);

/** Additive only, capped at the week's goal; records who gave the star, and
 *  logs it — with the reason, when one is given. A tap at the goal is a no-op
 *  and writes no history. */
export const addStar = (
  b: StarBank,
  giver: StarGiver = NEUTRAL_GIVER,
  opts: { note?: string; at?: string } = {},
): StarBank => {
  if (b.stars >= b.goal) return b;
  const note = opts.note?.trim();
  return {
    ...b,
    stars: b.stars + 1,
    givers: [...padGivers(b), giver],
    log: appendLog(b, {
      kind: "star",
      at: opts.at ?? new Date().toISOString(),
      giver,
      ...(note ? { note } : {}),
    }),
  };
};

/** Attach the reason to the star just given — the phone adds the star instantly
 *  and asks why afterwards, so the note lands on the newest star rather than
 *  standing in the way of the tap. An empty note clears it. */
export const noteLastStar = (b: StarBank, note: string): StarBank => {
  const log = b.log ?? [];
  const i = log.map((e) => e.kind).lastIndexOf("star");
  if (i < 0) return b;
  const trimmed = note.trim();
  const next = [...log];
  const star = next[i] as Extract<StarEvent, { kind: "star" }>;
  next[i] = trimmed ? { ...star, note: trimmed } : { kind: "star", at: star.at, giver: star.giver };
  return { ...b, log: next };
};

/** The only way stars come down: a deliberate fresh week, not a punishment.
 *  The history keeps the old stars and gains a marker for the new week. */
export const resetWeek = (b: StarBank, at?: string): StarBank => ({
  ...b,
  stars: 0,
  givers: [],
  log: appendLog(b, { kind: "week", at: at ?? new Date().toISOString() }),
});

export const setReward = (b: StarBank, reward: StarReward): StarBank => ({ ...b, reward });

/**
 * The wall's "the row just filled" detector, as a pure step so it can be tested
 * without a renderer.
 *
 * The distinction that matters is *crossing* into a full row versus *finding*
 * one. The wall reboots (HDMI handshake, a Chromium restart, the nightly Art
 * Mode swap) and every reboot re-reads the same settings row — a detector that
 * only asked "is it full?" would throw the whole-screen burst again every time,
 * which turns the one moment the child earned into wallpaper. So the first settled
 * read only *arms* the detector (`seen: null` → `seen: true/false`, no burst);
 * a burst needs a read that was genuinely short of the goal first.
 *
 * `celebrating` clears on its own timer (the burst is a fixed length) and is
 * forced off by a fresh week, so resetting mid-cheer stops the cheer.
 */
export type GoalWatch = {
  /** Whether the last settled read was a full row; null until the first one. */
  seen: boolean | null;
  celebrating: boolean;
};

export const GOAL_WATCH_INIT: GoalWatch = { seen: null, celebrating: false };

/** Fold one settled read of the bank's fullness into the watch. Idempotent —
 *  feeding the same value twice never fires twice (React double-invokes effects
 *  under StrictMode, and a Realtime echo of our own row is common). */
export function watchGoal(w: GoalWatch, full: boolean): GoalWatch {
  if (!full) return { seen: false, celebrating: false };
  return { seen: true, celebrating: w.seen === false || w.celebrating };
}
