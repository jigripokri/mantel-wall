import { useEffect, useState } from "react";
import { GOAL_WATCH_INIT, isFull, watchGoal, withAlpha, type StarBank } from "../lib/starBank";
import { FAMILY, accentColor } from "../config/family";
import { STAGE_W, STAGE_H } from "./Stage";

/**
 * The tenth star, on the whole wall.
 *
 * The locked star-bank design (D5, "Stepping stones") says the final star turns
 * the reward plate gold and that IS the celebration. The family asked for more:
 * the moment the row fills should be an event you can see from the kitchen, and
 * the won week should stay visibly won until someone starts a fresh one. So
 * there are two pieces, and only this file owns the loud one:
 *
 *   - THE BURST — this component. A few seconds, once, across all 1920×1080.
 *   - THE STANDING GLOW — the reward plate and earned stars, in the layout
 *     itself (see StarBankView in OatMoss), for the rest of the week.
 *
 * It lives in tv/ rather than in a layout because it is layout-independent, the
 * same reason the auth gate and the Stage do: whichever wall skin is up when the
 * row fills, the wall celebrates.
 */

/** How long the burst holds before it clears itself. Long enough that someone
 *  walking in on the tail still sees what happened; short enough to stay an
 *  event rather than becoming the screensaver. */
export const CELEBRATION_MS = 9000;

/**
 * True for CELEBRATION_MS after the row crosses into full — and never on a wall
 * that merely booted into a full row. `ready` must be false while the setting is
 * still loading: `useSetting` hands back the default (zero stars) until the real
 * row arrives, and arming on that would read the real value as a fresh win and
 * fire on every reboot. See `watchGoal` for the state machine (and its tests).
 */
export function useGoalCelebration(bank: StarBank, ready: boolean): boolean {
  const full = isFull(bank);
  const [watch, setWatch] = useState(GOAL_WATCH_INIT);

  useEffect(() => {
    if (!ready) return;
    setWatch((w) => watchGoal(w, full));
  }, [full, ready]);

  // The timer sits in its own effect keyed on `celebrating`, so a re-run of the
  // detector (StrictMode, a Realtime echo) can never strand the burst on screen
  // with its timeout cancelled.
  useEffect(() => {
    if (!watch.celebrating) return;
    const t = setTimeout(() => setWatch((w) => ({ ...w, celebrating: false })), CELEBRATION_MS);
    return () => clearTimeout(t);
  }, [watch.celebrating]);

  return watch.celebrating;
}

/** The burst mixes two tints so the shower doesn't read as one flat sheet: the
 *  neutral star colour, plus whichever configured person differs from it. */
const GOLD = FAMILY.neutralColor;
const BLUE = accentColor();

/** Deterministic 0..1 from a particle index and a salt — the burst looks the
 *  same every time it fires, so what we sign off in the preview is what hangs on
 *  the wall. (Nothing here may read the clock or Math.random: the wall and the
 *  preview must agree, and a snapshot of this file should be reproducible.) */
const rand = (i: number, salt: number): number => {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

/** Four glyph weights, so the shower reads as scattered stars rather than one
 *  repeated character. All are in the star family the rest of the app uses. */
const GLYPHS = ["★", "✦", "★", "✧", "✶"];

const CENTER_X = STAGE_W / 2;
const CENTER_Y = STAGE_H * 0.46;

/** The outward burst — thrown from behind the prize, flattened vertically and
 *  biased upward so it fountains rather than expanding as a plain circle.
 *
 *  Fired in three volleys (the `wave` term in the delay) rather than all at
 *  once: a single volley is over in a second and leaves the middle of the burst
 *  empty, which reads as one firework going off and then nothing. */
const SHARDS = Array.from({ length: 78 }, (_, i) => {
  const angle = (i / 78) * Math.PI * 2 + rand(i, 1) * 0.55;
  const reach = 300 + rand(i, 2) * 720;
  const wave = i % 3;
  return {
    glyph: GLYPHS[i % GLYPHS.length],
    dx: Math.cos(angle) * reach,
    dy: Math.sin(angle) * reach * 0.66 - 60,
    size: 30 + rand(i, 3) * 56,
    rot: (rand(i, 4) - 0.5) * 900,
    scale: 0.7 + rand(i, 5) * 0.9,
    delay: wave * 650 + rand(i, 6) * 320,
    dur: 2000 + rand(i, 7) * 1800,
    color: rand(i, 8) < 0.3 ? BLUE : GOLD,
  };
});

/** The rain that keeps the panel alive under the prize for the whole burst. */
const FALLS = Array.from({ length: 30 }, (_, i) => ({
  glyph: GLYPHS[(i + 2) % GLYPHS.length],
  left: rand(i, 11) * 100,
  size: 20 + rand(i, 12) * 30,
  dur: 5200 + rand(i, 13) * 4400,
  delay: -rand(i, 14) * 6000, // negative: already falling on the first frame
  rot: (rand(i, 15) - 0.5) * 720,
  opacity: 0.45 + rand(i, 16) * 0.5,
  color: rand(i, 17) < 0.3 ? BLUE : GOLD,
}));

/** Secondary starbursts, spread to the corners and staggered, so the wall keeps
 *  going off for a few beats instead of firing once in the middle. Hand-placed
 *  rather than random: they have to clear the prize card in the centre. Sized
 *  for the room — anything under ~140px on a 1920 stage is a speck at 75". */
const POPS = [
  { x: 20, y: 24, size: 190, delay: 300 },
  { x: 80, y: 19, size: 150, delay: 700 },
  { x: 13, y: 72, size: 170, delay: 1150 },
  { x: 86, y: 66, size: 210, delay: 1600 },
  { x: 50, y: 10, size: 140, delay: 2050 },
  { x: 34, y: 86, size: 160, delay: 2500 },
  { x: 67, y: 88, size: 180, delay: 2950 },
];

export function StarCelebration({ bank }: { bank: StarBank }) {
  return (
    <div
      className="mantel-celebrate absolute inset-0 overflow-hidden"
      style={{ ["--celebrate-ms" as string]: `${CELEBRATION_MS}ms`, pointerEvents: "none" }}
      aria-hidden
    >
      {/* Dim the wall to a theatre. The board is oat-white by day, so gold on
          gold would disappear; dropping the room is what lets the prize read
          from across it — and it works on every skin without knowing which is up.
          Nearly opaque on purpose: at anything lighter the ledger's own type
          stays legible and competes with the prize for the eye. */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(circle at 50% 46%, hsl(32 40% 8% / 0.93) 0%, hsl(26 26% 4% / 0.985) 62%)`,
        }}
      />

      {/* The starburst fan. A conic gradient of rays, masked to a ring so it
          radiates from behind the prize and dies out well before the edges.
          Kept faint and narrow — at any real weight this stops reading as light
          off the prize and starts reading as a sunburst poster. */}
      <div
        className="mantel-rays absolute"
        style={{
          left: CENTER_X,
          top: CENTER_Y,
          width: 2400,
          height: 2400,
          marginLeft: -1200,
          marginTop: -1200,
          background: `repeating-conic-gradient(from 0deg, ${withAlpha(GOLD, 0.13)} 0deg 1.6deg, transparent 1.6deg 13deg)`,
          WebkitMaskImage: "radial-gradient(circle, transparent 5%, black 17%, transparent 44%)",
          maskImage: "radial-gradient(circle, transparent 5%, black 17%, transparent 44%)",
        }}
      />

      {/* A warm bloom sitting on the fan, so the middle glows rather than
          reading as a bundle of hard lines. */}
      <div
        className="mantel-bloom absolute"
        style={{
          left: CENTER_X,
          top: CENTER_Y,
          width: 1100,
          height: 1100,
          marginLeft: -550,
          marginTop: -550,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${withAlpha(GOLD, 0.34)} 0%, transparent 62%)`,
        }}
      />

      {FALLS.map((f, i) => (
        <span
          key={`fall-${i}`}
          className="mantel-starfall font-display absolute leading-none"
          style={{
            left: `${f.left}%`,
            top: -60,
            fontSize: f.size,
            color: f.color,
            textShadow: `0 0 ${Math.round(f.size * 0.9)}px ${withAlpha(f.color, 0.7)}`,
            ["--dur" as string]: `${f.dur}ms`,
            ["--delay" as string]: `${f.delay}ms`,
            ["--rot" as string]: `${f.rot}deg`,
            ["--o" as string]: f.opacity,
          }}
        >
          {f.glyph}
        </span>
      ))}

      {POPS.map((p, i) => (
        <div key={`pop-${i}`} className="absolute" style={{ left: `${p.x}%`, top: `${p.y}%` }}>
          <div
            className="mantel-ring absolute"
            style={{
              width: p.size,
              height: p.size,
              marginLeft: -p.size / 2,
              marginTop: -p.size / 2,
              borderRadius: "50%",
              border: `3px solid ${withAlpha(GOLD, 0.85)}`,
              boxShadow: `0 0 30px ${withAlpha(GOLD, 0.5)}`,
              ["--delay" as string]: `${p.delay}ms`,
            }}
          />
          <span
            className="mantel-shard font-display absolute leading-none"
            style={{
              fontSize: p.size * 0.62,
              marginLeft: (-p.size * 0.62) / 2,
              marginTop: (-p.size * 0.62) / 2,
              color: GOLD,
              textShadow: `0 0 34px ${withAlpha(GOLD, 0.85)}`,
              ["--dx" as string]: "0px",
              ["--dy" as string]: "-14px",
              ["--s" as string]: 1.5,
              ["--rot" as string]: "90deg",
              ["--dur" as string]: "1100ms",
              ["--delay" as string]: `${p.delay}ms`,
            }}
          >
            ✦
          </span>
        </div>
      ))}

      {SHARDS.map((s, i) => (
        <span
          key={`shard-${i}`}
          className="mantel-shard font-display absolute leading-none"
          style={{
            left: CENTER_X,
            top: CENTER_Y,
            fontSize: s.size,
            marginLeft: -s.size / 2,
            marginTop: -s.size / 2,
            color: s.color,
            textShadow: `0 0 ${Math.round(s.size)}px ${withAlpha(s.color, 0.8)}`,
            ["--dx" as string]: `${Math.round(s.dx)}px`,
            ["--dy" as string]: `${Math.round(s.dy)}px`,
            ["--s" as string]: s.scale,
            ["--rot" as string]: `${Math.round(s.rot)}deg`,
            ["--dur" as string]: `${Math.round(s.dur)}ms`,
            ["--delay" as string]: `${Math.round(s.delay)}ms`,
          }}
        >
          {s.glyph}
        </span>
      ))}

      {/* The prize. Set on the wall's own type scale — this is the one screen in
          the app that gets to be enormous. */}
      <div
        className="absolute flex flex-col items-center text-center"
        style={{ left: 0, right: 0, top: CENTER_Y, transform: "translateY(-50%)" }}
      >
        <div
          className="mantel-rise font-text font-semibold uppercase"
          style={{
            fontSize: 30,
            letterSpacing: "0.42em",
            color: GOLD,
            textShadow: `0 0 26px ${withAlpha(GOLD, 0.6)}`,
            ["--delay" as string]: "260ms",
          }}
        >
          {bank.name} · {bank.goal} stars
        </div>
        <div
          className="mantel-bloom"
          style={{ fontSize: 168, lineHeight: 1.15, ["--delay" as string]: "120ms" }}
        >
          {bank.reward.icon}
        </div>
        <div
          className="mantel-rise font-display"
          style={{
            fontSize: 88,
            lineHeight: 1.05,
            color: "hsl(40 46% 96%)",
            textShadow: `0 0 60px ${withAlpha(GOLD, 0.55)}`,
            ["--delay" as string]: "440ms",
          }}
        >
          {bank.reward.label}
        </div>
        <div
          className="mantel-rise font-display italic font-light"
          style={{
            marginTop: 14,
            fontSize: 40,
            color: withAlpha(GOLD, 0.92),
            ["--delay" as string]: "620ms",
          }}
        >
          earned
        </div>
      </div>
    </div>
  );
}
