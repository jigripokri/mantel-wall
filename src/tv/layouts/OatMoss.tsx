import { greeting, dayPart, countdownLabel } from "../../lib/time";
import { agendaHeading } from "../../lib/agenda";
import { eventMeta } from "../../lib/format";
import { isDarkSkin } from "../../lib/tvTheme";
import { Crossfade, StalenessNotice } from "./shared";
import { StarBankView } from "./StarBank";
import type { WallData } from "./types";
import type { Entry } from "../../lib/types";
import type { Photo } from "../../lib/usePhoto";

/**
 * "Oat & moss" / "Walnut evening" — design spec state 13 (Part IV).
 *
 * A daylight desk spread in the room's warm browns and greens: a linen-into-moss
 * surface, greeting + clock + weather at the top-left, framed photo prints on
 * the left, and a dense ledger on the right (Today · Chores · star bank). The
 * same screen goes to deep walnut after dark (dayPart, overridable from the
 * phone via tv_theme).
 *
 * Values are lifted from the spec's inline styles and kept local rather than in
 * the global @theme: they are specific to this layout and still iterating.
 *
 * The board ships as two picker entries that differ ONLY in the photo area —
 * everything else is one shared Board:
 *   - OatMoss — P6a "Mantelpiece": three prints leaning on a hairline shelf.
 *   - OatMossStack — P2 "The stack": one print fully seen, two peeking behind.
 * In both, the newest photo takes the hero frame, only the hero is captioned,
 * rotation is fixed per slot (not per photo) so a new upload never makes the
 * wall jump, and with fewer photos the emptier slots simply don't render.
 */
type Tone = {
  surface: string;
  gradient: string;
  greetingAccent: string;
  clockInk: string;
  dim: string;
  /** Ink for the quietest line — the weather range (W3b-1). */
  faint: string;
  /** 1px hairline joining the weather column to the clock (W3b-1). */
  hairline: string;
  cardBg: string;
  cardShadow: string;
  caption: string;
  /** The mantelpiece (P6a): the hairline the framed prints lean on. */
  shelf: string;
  /** 1px warm rule on the mat — day only, where cream vanishes into oat. */
  frameRule: string | undefined;
  /** Shadow under a leaning print, and a touch deeper under the hero. */
  frameShadow: string;
  frameShadowHero: string;
  paneBg: string;
  eventTitle: string;
  rowBorder: string;
  /** Unearned stepping-stone dot in the star bank (D5). */
  starQuiet: string;
  stale: "light" | "dark";
};

const DAY: Tone = {
  surface: "hsl(38 30% 91%)",
  gradient: "linear-gradient(158deg, hsl(30 32% 89%) 0%, hsl(38 30% 91%) 48%, hsl(100 20% 86%) 100%)",
  greetingAccent: "hsl(140 32% 30%)",
  clockInk: "hsl(28 30% 18%)",
  dim: "hsl(30 14% 38%)",
  faint: "hsl(30 14% 52%)",
  hairline: "hsl(28 22% 74%)",
  cardBg: "hsl(40 44% 97%)",
  cardShadow: "0 8px 30px hsl(28 30% 18% / 0.22)",
  caption: "hsl(30 14% 38%)",
  shelf: "hsl(28 22% 74%)",
  frameRule: "1px solid hsl(34 24% 82%)",
  frameShadow: "0 8px 22px hsl(28 30% 18% / 0.14)",
  frameShadowHero: "0 12px 32px hsl(28 30% 18% / 0.17)",
  paneBg: "hsl(42 46% 96%)",
  eventTitle: "hsl(28 30% 18%)",
  rowBorder: "hsl(34 24% 86%)",
  starQuiet: "hsl(34 20% 82%)",
  stale: "light",
};

const EVENING: Tone = {
  surface: "hsl(26 22% 13%)",
  gradient: "linear-gradient(158deg, hsl(24 24% 16%) 0%, hsl(26 22% 13%) 52%, hsl(110 16% 14%) 100%)",
  greetingAccent: "hsl(110 26% 62%)",
  clockInk: "hsl(40 30% 93%)",
  dim: "hsl(36 14% 70%)",
  faint: "hsl(30 12% 52%)",
  hairline: "hsl(30 12% 28%)",
  cardBg: "hsl(40 26% 92%)",
  cardShadow: "0 10px 38px hsl(24 30% 4% / 0.55)",
  caption: "hsl(28 14% 40%)",
  shelf: "hsl(36 20% 80% / 0.22)",
  frameRule: undefined,
  frameShadow: "0 12px 30px hsl(24 30% 4% / 0.5)",
  frameShadowHero: "0 16px 46px hsl(24 30% 4% / 0.6)",
  paneBg: "hsl(26 18% 17%)",
  eventTitle: "hsl(40 30% 93%)",
  rowBorder: "hsl(30 12% 26%)",
  starQuiet: "hsl(30 12% 30%)",
  stale: "dark",
};

const MAX_EVENTS = 4;
const MAX_CHORES = 4;

type PhotoArea = "mantelpiece" | "stack";

/** The board with the P6a mantelpiece — the original "Oat & moss". */
export function OatMoss(props: WallData) {
  return <Board {...props} photoArea="mantelpiece" />;
}

/** The board with the P2 stack — same everything, different hang. */
export function OatMossStack(props: WallData) {
  return <Board {...props} photoArea="stack" />;
}

function Board({
  now,
  agenda,
  todos,
  upNext,
  starBank,
  weather,
  photos,
  theme,
  freshness,
  photoArea,
}: WallData & { photoArea: PhotoArea }) {
  const part = dayPart(now);
  // Two separate ideas: what the clock says (drives the greeting, heading, and
  // the sun-vs-moon mark) and which skin to paint (the phone can force it dark).
  const isNight = part === "evening" || part === "night";
  const isDark = isDarkSkin(theme, isNight);
  const t = isDark ? EVENING : DAY;
  const w = weather?.payload as { tempF?: number; code?: number; hiF?: number; loF?: number } | undefined;

  const time = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const [clock, meridiem] = time.split(" ");

  // Evening keeps the board's own "Tonight & tomorrow" (already an honest mixed
  // label); the day heading tells the truth about what's under it.
  const heading = isNight ? "Tonight & tomorrow" : agendaHeading(agenda);
  const events = agenda.rows.slice(0, MAX_EVENTS);
  const chores = todos.slice(0, MAX_CHORES);

  return (
    <div className="absolute inset-0" style={{ background: t.surface }}>
      <div className="absolute inset-0" style={{ background: t.gradient }} />

      {/* Left — greeting, clock, then the date with the weather set inline as a
          drawn mark (W2a). */}
      <div className="absolute" style={{ top: 60, left: 96 }}>
        <div
          className="font-text font-semibold uppercase"
          style={{ fontSize: 26, letterSpacing: "0.28em", color: t.greetingAccent }}
        >
          {greeting(now)}
        </div>
        <div className="mt-[10px] flex items-baseline gap-4">
          <span
            className="font-display leading-none tabular-nums"
            style={{ fontSize: 110, letterSpacing: "-0.01em", color: t.clockInk }}
          >
            {clock}
          </span>
          {meridiem && (
            <span className="font-display leading-none font-light" style={{ fontSize: 42, color: t.dim }}>
              {meridiem}
            </span>
          )}
        </div>
        <div className="mt-[12px] flex items-center gap-[20px]">
          <span className="font-display italic font-light leading-none" style={{ fontSize: 32, color: t.dim }}>
            {now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}
          </span>
          {w && (
            <>
              <span aria-hidden style={{ width: 1, height: 30, background: t.hairline }} />
              <WeatherMark kind={markKind(w.code, isNight)} size={44} ink={t.clockInk} faint={t.faint} />
              <span className="font-display leading-none tabular-nums" style={{ fontSize: 34, color: t.clockInk }}>
                {w.tempF != null ? `${Math.round(w.tempF)}°` : "--°"}
              </span>
              {w.hiF != null && w.loF != null && (
                <span className="font-text leading-none tabular-nums" style={{ fontSize: 28, color: t.faint }}>
                  H {Math.round(w.hiF)}° · L {Math.round(w.loF)}°
                </span>
              )}
            </>
          )}
        </div>
      </div>

      {/* Left — the photo hang; which one is the only thing the variants change. */}
      {photos.length > 0 &&
        (photoArea === "stack" ? (
          <StackedPrints photos={photos} tone={t} />
        ) : (
          <Mantelpiece photos={photos} tone={t} />
        ))}

      {/* Right — the ledger pane */}
      <div
        className="absolute box-border flex flex-col"
        style={{ top: 60, right: 96, bottom: 60, width: 620, background: t.paneBg, padding: "44px 48px" }}
      >
        <Label tone={t}>{heading}</Label>
        {events.length === 0 ? (
          <div className="mt-[18px] font-display italic" style={{ fontSize: 32, color: t.dim }}>
            A clear week.
          </div>
        ) : (
          events.map((e) => <EventRow key={e.id} entry={e} now={now} tone={t} />)
        )}

        {/* Up next sits with the schedule it belongs to, not at the far bottom. */}
        {upNext && (
          <div className="mt-[24px]">
            <Label tone={t}>Up next</Label>
            <div className="mt-[14px] flex items-baseline gap-[13px]">
              <span
                className="h-[10px] w-[10px] shrink-0 rounded-full"
                style={{
                  background: upNext.color ?? "var(--color-person-clay)",
                  transform: "translateY(-2px)",
                }}
                aria-hidden
              />
              <span className="font-display leading-[1.25]" style={{ fontSize: 32, color: t.eventTitle }}>
                {String((upNext.payload as { title?: string }).title ?? "Untitled")}
                <span
                  className="font-text ml-[10px] font-semibold"
                  style={{ fontSize: 26, color: t.greetingAccent }}
                >
                  {countdownLabel(now, new Date(upNext.starts_at!))}
                </span>
              </span>
            </div>
          </div>
        )}

        {chores.length > 0 && (
          <>
            <Label tone={t} className="mt-[28px]">
              Chores
            </Label>
            {chores.map((c) => (
              <ChoreRow key={c.id} entry={c} tone={t} />
            ))}
          </>
        )}

        {/* The star bank anchors the bottom of the ledger. */}
        <div className="mt-auto">
          {starBank && (
            <StarBankView bank={starBank} tone={{ quiet: t.starQuiet, rule: t.rowBorder }} />
          )}
        </div>
      </div>

      {/* Bottom-left so it never collides with the ledger in the other corner. */}
      <StalenessNotice freshness={freshness} tone={t.stale} align="left" />
    </div>
  );
}

/**
 * P6a "Three, evenly weighted" — design/iterations/mantel-photo-wall.html.
 *
 * Three framed prints propped on a hairline shelf along the bottom-left,
 * overlapping the way photos actually sit on a mantel. The newest takes the big
 * centre (hero) frame and is the only one captioned — its line set in the mat's
 * foot, which otherwise stays empty (mat, not a missing field).
 *
 * Geometry is the design's, in the wall's 1920×1080 space: a 956px field
 * (x 96→1052) that clears the ledger, frames bottom-aligned so they lean on the
 * shelf. Rotation is fixed per slot — two one way, one the other, never past
 * ±2.2° — so a new upload swaps an image without shifting the hang. With fewer
 * than three photos the emptier slots simply don't render; the hero slot is the
 * largest, so a lone photo lands there enlarged.
 */
const FRAMES = [
  // DOM order, so overlaps stack right: the hero sits over the left print, the
  // right print over the hero.
  { slot: "left", left: 0, width: 310, height: 384, pad: 14, foot: 42, rotate: -1.8, hero: false },
  { slot: "hero", left: 280, width: 420, height: 516, pad: 17, foot: 56, rotate: 0.6, hero: true },
  { slot: "right", left: 668, width: 288, height: 356, pad: 14, foot: 42, rotate: 1.6, hero: false },
] as const;

function Mantelpiece({ photos, tone }: { photos: Photo[]; tone: Tone }) {
  // Newest → hero (centre, largest); the next two become the side supports.
  const fill: Record<string, Photo | undefined> = {
    hero: photos[0],
    left: photos[1],
    right: photos[2],
  };

  return (
    <>
      {/* The shelf the prints lean on. */}
      <div
        className="absolute"
        style={{ left: 96, right: 868, bottom: 140, height: 1, background: tone.shelf }}
      />
      {/* The leaning prints, bottom-aligned onto the shelf. */}
      <div className="absolute" style={{ left: 96, right: 868, bottom: 141, height: 560 }}>
        {FRAMES.map((f) => {
          const p = fill[f.slot];
          if (!p) return null;
          return (
            <div
              key={f.slot}
              className="absolute box-border flex flex-col"
              style={{
                left: f.left,
                bottom: 0,
                width: f.width,
                height: f.height,
                background: tone.cardBg,
                border: tone.frameRule,
                boxShadow: f.hero ? tone.frameShadowHero : tone.frameShadow,
                transform: `rotate(${f.rotate}deg)`,
                padding: `${f.pad}px ${f.pad}px 0`,
              }}
            >
              <div className="relative w-full flex-1 overflow-hidden">
                <Crossfade src={p.url} />
              </div>
              {/* The mat's deep instant-print foot; the hero's caption sits in it. */}
              <div className="flex items-center justify-center px-[6px] text-center" style={{ height: f.foot }}>
                {f.hero && p.caption && (
                  <span
                    className="font-display italic leading-tight"
                    style={{ fontSize: 25, color: tone.caption }}
                  >
                    {p.caption}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

/**
 * P2 "The stack — three, only one fully seen" — design/iterations/
 * mantel-photo-wall.html #p2. One print sits forward and fully readable; the
 * next two peek out behind it, tilted the way a real pile of prints sits. Only
 * the hero is captioned, in its deep instant-print foot.
 *
 * Geometry is the design's, in the wall's 1920×1080 space: an 820×640 field at
 * (150, 290), clear of the ledger at 1148. Rotation is fixed per slot so a new
 * photo never shifts the pile. The newest photo is the hero; with two photos
 * one peek renders, with one the hero stands alone — no empty frames. The
 * design imagines the top print sliding away every few minutes; here the shared
 * hourly one-frame drift does the same job at the wall's calmer cadence.
 */
const STACK_FRAMES = [
  // DOM order is stacking order: the hero renders last, on top of both peeks.
  { slot: 2, left: 330, top: 26, width: 430, height: 520, pad: 16, foot: 52, rotate: 8, hero: false },
  { slot: 1, left: 44, top: 74, width: 430, height: 520, pad: 16, foot: 52, rotate: -7, hero: false },
  { slot: 0, left: 186, top: 0, width: 470, height: 566, pad: 18, foot: 62, rotate: -1.5, hero: true },
] as const;

function StackedPrints({ photos, tone }: { photos: Photo[]; tone: Tone }) {
  return (
    <div className="absolute" style={{ left: 150, top: 290, width: 820, height: 640 }}>
      {STACK_FRAMES.map((f) => {
        const p = photos[f.slot];
        if (!p) return null;
        return (
          <div
            key={f.slot}
            className="absolute box-border flex flex-col"
            style={{
              left: f.left,
              top: f.top,
              width: f.width,
              height: f.height,
              background: tone.cardBg,
              border: tone.frameRule,
              boxShadow: f.hero ? tone.frameShadowHero : tone.frameShadow,
              transform: `rotate(${f.rotate}deg)`,
              padding: `${f.pad}px ${f.pad}px 0`,
            }}
          >
            <div className="relative w-full flex-1 overflow-hidden">
              <Crossfade src={p.url} />
            </div>
            {/* The mat's foot; only the hero's carries a caption. */}
            <div className="flex items-center justify-center px-[6px] text-center" style={{ height: f.foot }}>
              {f.hero && p.caption && (
                <span
                  className="font-display italic leading-tight"
                  style={{ fontSize: 26, color: tone.caption }}
                >
                  {p.caption}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

type MarkKind = "sun" | "moon" | "cloud" | "rain";

/** Open-Meteo code → mark: clear is sun by day and a crescent after dark;
 *  overcast/fog is a cloud; anything wetter is rain. */
function markKind(code: number | undefined, isNight: boolean): MarkKind {
  if (code == null || code <= 2) return isNight ? "moon" : "sun"; // clear / mainly clear
  if (code <= 48) return "cloud"; // overcast, fog
  return "rain"; // drizzle, rain, snow, showers, thunderstorm
}

/**
 * W2 "drawn mark" — the weather as circles and bars in the skin's ink colour
 * (sun, crescent, cloud, rain), the same drawing language as the star field and
 * the person dots, so it inherits the ink and stays crisp at 4K. Geometry is the
 * design's (design/iterations/mantel-photo-wall.html — the renderVals weather
 * marks); the crescent is a full disc with a circular bite masked out.
 */
function WeatherMark({ kind, size: s, ink, faint }: { kind: MarkKind; size: number; ink: string; faint: string }) {
  const base: React.CSSProperties = { position: "relative", width: s, height: s, flex: "none" };
  const cloud = (tint: string) => (
    <>
      <div style={{ position: "absolute", left: s * 0.06, bottom: s * 0.28, width: s * 0.88, height: s * 0.26, borderRadius: s * 0.13, background: tint }} />
      <div style={{ position: "absolute", left: s * 0.18, bottom: s * 0.4, width: s * 0.34, height: s * 0.34, borderRadius: "50%", background: tint }} />
      <div style={{ position: "absolute", left: s * 0.44, bottom: s * 0.44, width: s * 0.42, height: s * 0.42, borderRadius: "50%", background: tint }} />
    </>
  );

  if (kind === "sun") {
    return (
      <div style={base} aria-hidden>
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            style={{
              position: "absolute", left: "50%", top: "50%", width: 3, height: s * 0.94, background: ink,
              transform: `translate(-50%,-50%) rotate(${i * 45}deg)`,
              clipPath: "polygon(0 0, 100% 0, 100% 22%, 0 22%, 0 78%, 100% 78%, 100% 100%, 0 100%)",
            }}
          />
        ))}
        <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: s * 0.5, height: s * 0.5, borderRadius: "50%", background: ink }} />
      </div>
    );
  }
  if (kind === "moon") {
    const d = s * 0.77;
    const mask = `radial-gradient(circle ${s * 0.365}px at ${s * 0.5748}px ${s * 0.2974}px, transparent 99%, #000 100%)`;
    return (
      <div style={base} aria-hidden>
        <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: d, height: d, borderRadius: "50%", background: ink, WebkitMaskImage: mask, maskImage: mask }} />
      </div>
    );
  }
  if (kind === "cloud") {
    return (
      <div style={base} aria-hidden>
        {cloud(ink)}
      </div>
    );
  }
  return (
    <div style={base} aria-hidden>
      {cloud(ink)}
      {[0.24, 0.46, 0.68].map((x) => (
        <div key={x} style={{ position: "absolute", left: s * x, bottom: s * 0.02, width: 3, height: s * 0.2, background: faint, transform: "rotate(14deg)" }} />
      ))}
    </div>
  );
}

function Label({ children, tone, className = "" }: { children: React.ReactNode; tone: Tone; className?: string }) {
  return (
    <div
      className={`font-text font-semibold uppercase ${className}`}
      style={{ fontSize: 26, letterSpacing: "0.24em", color: tone.dim }}
    >
      {children}
    </div>
  );
}

function EventRow({ entry, now, tone }: { entry: Entry; now: Date; tone: Tone }) {
  const title = String((entry.payload as { title?: string }).title ?? "Untitled");
  return (
    <div
      className="flex items-baseline gap-[13px] py-[14px]"
      style={{ borderBottom: `1px solid ${tone.rowBorder}` }}
    >
      <span
        className="h-[10px] w-[10px] shrink-0 rounded-full"
        style={{ background: entry.color ?? "var(--color-person-clay)", transform: "translateY(-2px)" }}
        aria-hidden
      />
      <span className="font-display leading-[1.25]" style={{ fontSize: 32, color: tone.eventTitle }}>
        {title}
        <span className="font-text ml-[8px]" style={{ fontSize: 26, color: tone.dim }}>
          {" "}
          {eventMeta(entry, now)}
        </span>
      </span>
    </div>
  );
}

function ChoreRow({ entry, tone }: { entry: Entry; tone: Tone }) {
  const done = entry.status === "done";
  const title = String((entry.payload as { title?: string }).title ?? "Untitled");
  const who = (entry.payload as { person?: string }).person;
  const color = entry.color ?? "var(--color-person-clay)";
  return (
    <div className="mt-[14px] flex items-baseline gap-[13px]" style={{ opacity: done ? 0.45 : 1 }}>
      <span
        className="box-border h-[12px] w-[12px] shrink-0 rounded-full"
        style={{
          background: done ? color : "transparent",
          border: done ? undefined : `2px solid ${color}`,
          transform: "translateY(-1px)",
        }}
        aria-hidden
      />
      <span className="font-display leading-[1.25]" style={{ fontSize: 31, color: tone.eventTitle }}>
        {title}
        {(who || done) && (
          <span className="font-text ml-[8px]" style={{ fontSize: 26, color: tone.dim }}>
            {" "}
            {[who, done ? "done" : null].filter(Boolean).join(" · ")}
          </span>
        )}
      </span>
    </div>
  );
}
