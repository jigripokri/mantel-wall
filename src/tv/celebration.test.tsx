import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { StarCelebration } from "./StarCelebration";
import { OatMoss } from "./layouts/OatMoss";
import { SideVeil } from "./layouts/SideVeil";
import { DEFAULT_STAR_BANK, type StarBank } from "../lib/starBank";
import { FAMILY } from "../config/family";
import type { WallData } from "./layouts/types";

/**
 * The tenth star's two celebrations, rendered.
 *
 * Both are nearly untestable by eye in the normal course of things: the burst is
 * on screen for nine seconds a week, and the standing glow only appears once a
 * row is full. A crash or a silently-dropped class in either would surface at the
 * exact moment it matters most, in front of the child who just earned it. So the
 * wall is rendered to markup here and asked what it is showing.
 *
 * Static markup, no DOM: the assertions are about what the wall *emits* — the
 * prize, and the classes the CSS animations hang off — not about how it animates.
 */
const wall = (bank: StarBank): WallData => ({
  now: new Date("2026-08-01T18:00:00.000Z"),
  agenda: { rows: [], more: 0, hasToday: false, allToday: false },
  todos: [],
  upNext: null,
  starBank: bank,
  weather: undefined,
  photos: [],
  theme: "auto",
  live: false,
  freshness: { stale: false, minutesSinceSuccess: 3 },
});

const bank = (over: Partial<StarBank> = {}): StarBank => ({ ...DEFAULT_STAR_BANK, ...over });

/** A full row, whatever the configured goal is — a fork that sets a goal other
 *  than ten must still pass these. */
const GOAL = DEFAULT_STAR_BANK.goal;

/** Every wall that banks stars. They share one graphic (layouts/StarBank.tsx),
 *  drawn at different scales — so a week reads the same whichever is up, and a
 *  class dropped from the shared view can't survive on one wall and vanish from
 *  the other. */
const WALLS = [
  { name: "Oat & moss", Layout: OatMoss },
  { name: "Side veil", Layout: SideVeil },
] as const;

describe("the tenth star", () => {
  it("names the prize on the burst, big enough to read across the room", () => {
    const html = renderToStaticMarkup(
      <StarCelebration bank={bank({ stars: GOAL, reward: { icon: "🍦", label: "Ice cream" } })} />,
    );
    expect(html).toContain("Ice cream");
    expect(html).toContain("🍦");
    expect(html).toContain(FAMILY.starBank.childName);
    expect(html).toContain(`${GOAL} stars`);
  });

  describe.each(WALLS)("on $name", ({ Layout }) => {
    it("keeps the celebration alive on the wall for as long as the row stands full", () => {
      const html = renderToStaticMarkup(<Layout {...wall(bank({ stars: GOAL }))} />);
      expect(html).toContain("mantel-breathe"); // the prize
      expect(html).toContain("mantel-aura"); // its halo
      expect(html).toContain("mantel-lift"); // sparkles off it
      expect(html).toContain("mantel-plate"); // light travelling the gold plate
      expect(html).toContain("mantel-twinkle"); // the earned stars
    });

    it("leaves a week still in progress completely still", () => {
      // One short of the goal is not a celebration. Movement in the star field
      // has to mean "won" or it means nothing.
      const html = renderToStaticMarkup(<Layout {...wall(bank({ stars: GOAL - 1 }))} />);
      for (const cls of ["mantel-breathe", "mantel-aura", "mantel-lift", "mantel-plate", "mantel-twinkle"]) {
        expect(html).not.toContain(cls);
      }
    });

    it("shows the week's reward, and one mark per star in the goal", () => {
      // The row has to be countable across a room: a mark for every step of the
      // goal, earned or not, and the prize waiting at the end. A goal that isn't
      // ten is the family's to set from the phone, so it can't be assumed.
      const html = renderToStaticMarkup(
        <Layout {...wall(bank({ stars: 3, goal: 7, reward: { icon: "🥾", label: "Hike" } }))} />,
      );
      expect(html).toContain("🥾");
      expect(html.match(/★/g) ?? []).toHaveLength(3);
      // Seven stones: three earned stars plus four still-quiet dots.
      expect(html.match(/border-radius:50%/g) ?? []).toHaveLength(7);
    });

    it("survives a wall with no star bank at all", () => {
      // The layout takes a null bank (the section is optional); it must not throw.
      const noBank = { ...wall(bank()), starBank: null };
      expect(() => renderToStaticMarkup(<Layout {...noBank} />)).not.toThrow();
    });
  });
});
