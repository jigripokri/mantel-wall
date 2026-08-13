import { useEffect, useRef, useState, type ReactNode } from "react";

export const STAGE_W = 1920;
export const STAGE_H = 1080;

/**
 * A fixed 1920x1080 logical canvas, scaled to fit whatever viewport it lands in.
 *
 * The design is specified in literal logical pixels ("clock is 120px, safe area
 * is 96px"), and the Frame renders at 3840x2160. Rather than re-derive every
 * size in responsive units — which is where pixel-accurate designs go to die —
 * we author at 1920x1080 and scale the whole plane. 4K is then an exact 2x, and
 * a laptop preview is the same layout at a smaller scale, so what we verify
 * locally is what hangs on the wall.
 */
export function Stage({
  children,
  /**
   * Kiosk behaviours — click-to-fullscreen and a hidden cursor. Off by default
   * and deliberately NOT enabled for the signed-out gate: that screen contains
   * a real form, and a frame-level click handler would fire when someone taps
   * the email field, while a hidden cursor would make it unusable.
   */
  kiosk = false,
}: {
  children: ReactNode;
  kiosk?: boolean;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  // Observe the frame's own box rather than listening for window resize:
  // ResizeObserver also fires for the cases a kiosk actually hits — the panel
  // reporting its real mode after HDMI handshake, Chromium starting windowed
  // before going fullscreen, and any embedding container — none of which
  // reliably emit a window resize event.
  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const fit = () => {
      const { width, height } = el.getBoundingClientRect();
      if (width > 0 && height > 0) setScale(Math.min(width / STAGE_W, height / STAGE_H));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Click anywhere to fill the screen. The canvas is letterboxed to 16:9, so any
  // browser chrome above it makes the remaining viewport the wrong shape and the
  // wall renders as a box in the middle of the display. Fullscreen is the fix,
  // and it CANNOT be requested on load — browsers only grant it from a user
  // gesture — so the wall has to offer it rather than take it.
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {
        /* denied or unsupported — stay windowed rather than break the wall */
      });
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  return (
    <div
      ref={frame}
      onClick={kiosk ? toggleFullscreen : undefined}
      className="fixed inset-0 overflow-hidden bg-black"
      // A pointer arrow parked on a 75" panel is the least gallery-like thing
      // imaginable. There is no mouse on the kiosk anyway.
      style={kiosk ? { cursor: "none" } : undefined}
    >
      <div
        className="absolute top-1/2 left-1/2 origin-center overflow-hidden bg-surface"
        style={{
          width: STAGE_W,
          height: STAGE_H,
          transform: `translate(-50%, -50%) scale(${scale})`,
        }}
      >
        {children}
      </div>
    </div>
  );
}
