import { useEffect, useRef, useState } from "react";
import { describeAge, type Freshness } from "../../lib/useFreshness";

/**
 * Cross-fades between successive `src`s in place. When the source changes the new
 * image fades in (1.2s, opacity only — no slide or zoom) over the outgoing one,
 * which is then dropped. The element's box, position and any transform (a frame's
 * rotation) stay put; only the pixels dissolve, per the rotation spec. The first
 * paint shows instantly. An unchanged `src` is a no-op, so a frame that didn't
 * rotate never dissolves.
 */
export function Crossfade({ src, className = "" }: { src: string; className?: string }) {
  const [layers, setLayers] = useState<{ src: string; k: number }[]>(() => [{ src, k: 0 }]);
  const kRef = useRef(0);

  useEffect(() => {
    setLayers((prev) => {
      const top = prev[prev.length - 1];
      if (top && top.src === src) return prev; // unchanged — no dissolve
      kRef.current += 1;
      return [...prev, { src, k: kRef.current }].slice(-2); // keep outgoing + incoming
    });
  }, [src]);

  return (
    <>
      {layers.map((layer, i) => {
        const incoming = i === layers.length - 1 && layers.length > 1;
        return (
          <img
            key={layer.k}
            src={layer.src}
            alt=""
            // The incoming layer fades in over the outgoing one; when it lands,
            // drop everything beneath it.
            onAnimationEnd={incoming ? () => setLayers((ls) => ls.slice(-1)) : undefined}
            className={`absolute inset-0 h-full w-full object-cover ${incoming ? "mantel-fadein" : ""} ${className}`}
          />
        );
      })}
    </>
  );
}

/**
 * The staleness notice, shared by every layout because the reason it exists is
 * layout-independent: a stalled pipeline (cron unscheduled, feed revoked,
 * function throwing) is otherwise invisible — the wall just keeps showing
 * yesterday, confidently. It is a diagnostic, not content, so it sits in the far
 * corner below the 26px legibility floor; anyone close enough to read it is close
 * enough to act on it.
 *
 * `tone` exists because ink is not layout-independent: a dark-on-light layout
 * needs dark ink and no glow, where 5B needs faint light ink and a shadow to
 * survive a bright patch of photo.
 */
export function StalenessNotice({
  freshness,
  tone,
  align = "right",
}: {
  freshness: Freshness;
  tone: "dark" | "light";
  /** Which bottom corner. Layouts whose content already fills the bottom-right
   *  (the board's ledger pane) put it bottom-left instead so it can't collide. */
  align?: "left" | "right";
}) {
  if (!freshness.stale) return null;
  const dark = tone === "dark";
  return (
    <div
      className="font-text absolute text-[15px] leading-none"
      style={{
        [align]: "var(--spacing-safe-x)",
        bottom: "var(--spacing-safe-y)",
        letterSpacing: "0.08em",
        color: dark ? "var(--color-ink-faint-photo)" : "hsl(30 14% 44%)",
        opacity: 0.6,
        textShadow: dark ? "0 1px 10px hsl(26 12% 7% / 0.85)" : undefined,
      }}
    >
      Last updated {describeAge(freshness.minutesSinceSuccess)}
    </div>
  );
}
