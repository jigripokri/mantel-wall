import { isFull, starColor, starGiverAt, starGlow, withAlpha, type StarBank } from "../../lib/starBank";

/** Gold that reads as "gold star" on oat, on walnut, and over a veiled photo. */
export const STAR_GOLD = "hsl(44 74% 56%)";

/**
 * D5 "Stepping stones" — Claude Design, locked (design/iterations/mantel-star-bank.html).
 *
 * Ten stones on a gentle rise: a quiet dot until earned, then a gold ★ that
 * glows. The reward waits under a hairline plate at the end. Stone positions are
 * constant every week so the field reads as a place, not a meter.
 *
 * D5 said the plate going gold IS the celebration — no numerals, no count, no
 * copy. The family overruled the quiet half of that (2026-08): a won week now
 * *stays* visibly won. The plate glows and a light travels it, the prize breathes
 * under a halo and throws sparkles, and the earned stars twinkle — until someone
 * starts a fresh week and every one of those stops at once. The loud half, the
 * whole-wall burst on the tenth star itself, is `StarCelebration` in tv/.
 *
 * What survives of D5's restraint: still no numerals, no count, no copy. Every
 * bit of this is the same graphic, alive.
 *
 * Shared by every layout that banks stars, because the graphic is the family's
 * agreement about what a week looks like — it has to be the same object on
 * whichever wall is up, not two drawings that drift apart. Only two things are
 * the layout's to decide: the two quiet inks it draws against (`tone`), and how
 * much room it has (`scale`).
 */
export type StarBankTone = {
  /** An unearned stepping stone. */
  quiet: string;
  /** The hairline plate under the reward, before the row fills. */
  rule: string;
};

/**
 * How large the graphic is drawn. The stones' *horizontal* placement never
 * changes — a star has to land in the same spot on every wall, or the field
 * stops being a place — so a scale only moves what the surrounding layout can
 * actually spare: the block's height, and how big the marks in it are drawn.
 */
export type StarBankScale = {
  /** The block's height. The reward centres on it. */
  height: number;
  /** Where the stepping-stone field starts inside the block. */
  fieldTop: number;
  /** The field's height — the rise's amplitude is a fraction of it. */
  fieldH: number;
  /** Mark size, as a fraction of the board's. 1 is the drawing D5 locked. */
  mark: number;
};

/** Oat & moss — the ledger pane has room, so the field breathes. */
export const BOARD_SCALE: StarBankScale = { height: 200, fieldTop: 34, fieldH: 132, mark: 1 };

/**
 * Side veil — the foot of a single column of type that is nearly full by the
 * time it reaches here, so the block *is* the field: no lead-in, and a rise
 * shortened to 112. Marks stay at `mark` 1. Shrinking them was tried first and
 * is the wrong economy — under about 100px of height the rise flattens until ten
 * stones read as a dotted line rather than a place, and the row stops being
 * countable across a room, which is the one thing it has to be.
 */
export const COLUMN_SCALE: StarBankScale = { height: 112, fieldTop: 0, fieldH: 112, mark: 1 };

const STAR_FIELD_W = 376;
/** An unearned stone — the same on every wall; only its ink changes. */
const QUIET_DOT = 10;

/** Sparkles lifting off the prize while the row stands full — hand-placed and
 *  staggered across the 4s cycle so one is always on the way up. */
const REWARD_SPARKS = [
  { x: -30, size: 14, delay: 0 },
  { x: 14, size: 11, delay: 800 },
  { x: 32, size: 15, delay: 1600 },
  { x: -12, size: 10, delay: 2400 },
  { x: 24, size: 12, delay: 3200 },
];

/**
 * The reward's geometry at `mark` = 1 — the medal, its halo, the plate and the
 * box they sit in, as D5 drew them. Every one is derived from `mark` rather than
 * tuned per layout, so a smaller wall gets the same object smaller and the two
 * boards can't drift apart one nudge at a time.
 */
const REWARD = { box: 84, boxH: 56, prize: 48, medal: 78, aura: 150, gap: 14, plate: 5, plateGap: 12 };
const px = (v: number, mark: number) => Math.round(v * mark);

export function StarBankView({
  bank,
  tone,
  scale = BOARD_SCALE,
}: {
  bank: StarBank;
  tone: StarBankTone;
  scale?: StarBankScale;
}) {
  const full = isFull(bank);
  const span = bank.goal > 1 ? 93 / (bank.goal - 1) : 0;
  const m = scale.mark;
  const r = {
    box: px(REWARD.box, m),
    boxH: px(REWARD.boxH, m),
    prize: px(REWARD.prize, m),
    medal: px(REWARD.medal, m),
    aura: px(REWARD.aura, m),
    gap: px(REWARD.gap, m),
    plate: px(REWARD.plate, m),
    plateGap: px(REWARD.plateGap, m),
  };

  // Graphic only — no heading. The stepping-stone field and the reward carry it.
  return (
    <div className="relative" style={{ height: scale.height }}>
      <div
        className="absolute"
        style={{ left: 0, top: scale.fieldTop, width: STAR_FIELD_W, height: scale.fieldH }}
      >
        {Array.from({ length: bank.goal }).map((_, i) => {
          const earned = i < bank.stars;
          const size = earned ? px(32, m) : px(QUIET_DOT, m);
          const left = ((3 + i * span) / 100) * STAR_FIELD_W;
          const top = ((50 + 30 * Math.sin(i * 0.8)) / 100) * scale.fieldH;
          // Tinted by who gave it; unknown and legacy stars take the neutral.
          const color = starColor(starGiverAt(bank, i));
          return (
            <div
              key={i}
              // The twinkle is the full row's, never a partial one: a week in
              // progress stays still, so movement in the field means "won".
              className={`font-display absolute text-center${full ? " mantel-twinkle" : ""}`}
              style={{
                left,
                top,
                width: size,
                height: size,
                marginLeft: -size / 2,
                marginTop: -size / 2,
                borderRadius: "50%",
                background: earned ? "transparent" : tone.quiet,
                color: earned ? color : "transparent",
                fontSize: size,
                lineHeight: 1,
                textShadow: earned ? starGlow(color, full ? 26 : 18) : undefined,
                ["--delay" as string]: `${i * 190}ms`,
              }}
              aria-hidden
            >
              {earned ? "★" : ""}
            </div>
          );
        })}
      </div>
      {/* The reward, under a hairline plate that goes gold — and comes alive —
          when the row fills. */}
      <div
        className="absolute top-1/2 right-0 flex flex-col items-center"
        style={{ transform: "translateY(-50%)", gap: r.gap }}
      >
        <div
          className="relative flex items-center justify-center"
          style={{ width: r.box, height: r.boxH }}
        >
          {full && (
            <>
              <div
                className="mantel-aura absolute"
                style={{
                  width: r.aura,
                  height: r.aura,
                  borderRadius: "50%",
                  background: `radial-gradient(circle, ${withAlpha(STAR_GOLD, 0.5)} 0%, transparent 66%)`,
                }}
                aria-hidden
              />
              {/* The medal. A glow alone is invisible on the daylight board —
                  light needs dark to read against, and oat gives it none, which
                  is the whole complaint about the old gold underline. So the
                  won state carries mass as well as light: a filled disc with a
                  solid ring, which reads as a struck medal on cream and as a
                  lit disc on walnut. */}
              <div
                className="absolute"
                style={{
                  width: r.medal,
                  height: r.medal,
                  borderRadius: "50%",
                  background: `radial-gradient(circle, ${withAlpha(STAR_GOLD, 0.5)} 0%, ${withAlpha(STAR_GOLD, 0.16)} 66%, transparent 72%)`,
                  border: `2px solid ${STAR_GOLD}`,
                  boxShadow: `0 0 26px ${withAlpha(STAR_GOLD, 0.55)}`,
                }}
                aria-hidden
              />
              {REWARD_SPARKS.map((s, i) => (
                <span
                  key={i}
                  className="mantel-lift font-display absolute leading-none"
                  // Explicit top: an absolutely-positioned child of a flex box
                  // with `top: auto` lands on its static position, which engines
                  // resolve differently. The Pi's Chromium and the preview have
                  // to agree.
                  style={{
                    left: "50%",
                    top: px(28, m),
                    marginLeft: px(s.x, m),
                    fontSize: px(s.size, m),
                    color: STAR_GOLD,
                    textShadow: `0 0 14px ${withAlpha(STAR_GOLD, 0.8)}`,
                    ["--delay" as string]: `${s.delay}ms`,
                  }}
                  aria-hidden
                >
                  ✦
                </span>
              ))}
            </>
          )}
          <span
            className={full ? "mantel-breathe relative" : "relative"}
            style={{
              fontSize: r.prize,
              lineHeight: 1,
              opacity: full ? 1 : bank.stars === 0 ? 0.4 : 0.7,
              textShadow: full ? `0 0 30px ${withAlpha(STAR_GOLD, 0.45)}` : undefined,
            }}
            aria-hidden
          >
            {bank.reward.icon}
          </span>
        </div>
        <div
          className={full ? "mantel-plate" : undefined}
          style={{
            width: r.box,
            height: full ? r.plate : 1,
            marginTop: full ? r.plateGap : 0, // clear of the medal, which overhangs the box
            background: full ? STAR_GOLD : tone.rule,
            boxShadow: full ? `0 0 18px ${withAlpha(STAR_GOLD, 0.85)}` : undefined,
          }}
        />
      </div>
    </div>
  );
}
