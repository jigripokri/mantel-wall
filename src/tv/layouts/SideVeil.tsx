import { greeting, countdownLabel, fmtClock } from "../../lib/time";
import { formatWeather, eventMeta } from "../../lib/format";
import { StalenessNotice } from "./shared";
import { StarBankView, COLUMN_SCALE } from "./StarBank";
import { agendaHeading } from "../../lib/agenda";
import type { WallData } from "./types";

const MAX_ROWS = 3;

/**
 * The two quiet inks the star bank draws against here. Both are the veil's own
 * hairline colour: the resting plate is exactly the rule under the clock, and an
 * unearned stone sits one step up from it — present enough to count across the
 * room, quiet enough that ten of them never read as content.
 */
const STAR_TONE = { quiet: "hsl(36 20% 80% / 0.32)", rule: "hsl(36 20% 80% / 0.18)" };

/**
 * 5B "Side veil" — the original wall (design/design_handoff_mantel_5b).
 *
 * Three stacked layers: a full-bleed photo, a gradient veil rising from the left
 * edge, and a single quiet column of type on the veil. With no photo the first
 * two drop away and the veil colour becomes the whole surface; the column is
 * identical either way, only its ink tokens change.
 *
 * Lifted verbatim out of TvWall when the wall became layout-switchable — no
 * visual change.
 *
 * The star bank (2026-08) is the column's fourth section, and the column only
 * ever had room for three: on a full day — three events, an overflow line, Up
 * next and three tasks — it already reached the bottom safe margin exactly. So
 * the section breaks above it were shortened (38/34/44 → 30/26/32) to pay for
 * it. The *row* rhythm inside each list is untouched, deliberately: the gaps
 * between rows are what the eye reads as the column's calm, and the gaps between
 * sections are what it merely feels.
 */
export function SideVeil({
  now,
  agenda,
  todos,
  upNext,
  starBank,
  weather,
  photos,
  live,
  freshness,
}: WallData) {
  // 5B is composed around a single full-bleed photo; the board hangs the rest.
  const photo = photos[0] ?? null;
  const ink = photo
    ? { base: "text-ink-photo", soft: "text-ink-soft-photo", dim: "text-ink-dim-photo", faint: "text-ink-faint-photo", accent: "text-accent-photo" } // prettier-ignore
    : { base: "text-ink", soft: "text-ink-soft", dim: "text-ink-dim", faint: "text-ink-faint", accent: "text-accent" }; // prettier-ignore

  return (
    <>
      {photo && (
        <>
          <img
            key={photo.url}
            src={photo.url}
            alt=""
            className="mantel-kenburns absolute inset-0 h-full w-full object-cover"
          />
          <div className="mantel-veil absolute inset-0" />
        </>
      )}

      <div
        className="absolute flex flex-col"
        style={{
          top: "var(--spacing-safe-y)",
          bottom: "var(--spacing-safe-y)",
          left: "var(--spacing-safe-x)",
          width: "var(--spacing-column)",
          textShadow: photo ? "0 2px 28px hsl(26 12% 7% / 0.6)" : undefined,
        }}
      >
        <div
          className={`font-text text-label leading-none font-semibold uppercase ${ink.accent}`}
          style={{ letterSpacing: "0.28em" }}
        >
          {greeting(now)}
        </div>

        <ClockLine now={now} ink={ink} />

        <div className={`font-display text-date mt-3 leading-none italic ${ink.dim}`}>
          {now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}
          {weather && (
            <>
              {" · "}
              <span className="font-text text-weather leading-none font-normal not-italic">
                {formatWeather(weather)}
              </span>
            </>
          )}
        </div>

        <div className="mt-[30px] h-px" style={{ background: "hsl(36 20% 80% / 0.18)" }} />

        <SectionLabel className="mt-[26px]" ink={ink}>
          {agendaHeading(agenda)}
        </SectionLabel>

        {agenda.rows.length === 0 ? (
          <p className={`font-display text-row-title mt-5 leading-none italic ${ink.dim}`}>
            A clear week.
          </p>
        ) : (
          <>
            {agenda.rows.map((e, i) => (
              <Row
                key={e.id}
                dot={<Dot color={e.color} />}
                title={String((e.payload as { title?: string }).title ?? "Untitled")}
                meta={eventMeta(e, now)}
                first={i === 0}
                ink={ink}
              />
            ))}
            {agenda.more > 0 && <More count={agenda.more} ink={ink} />}
          </>
        )}

        {/* Up next sits with the schedule it belongs to rather than at the far
            bottom — the same move the board makes, and what frees the foot of
            the column for the star bank. Set tighter than a section break, so it
            reads as part of what's above it. */}
        {upNext && (
          <>
            <SectionLabel className="mt-[24px]" ink={ink}>
              Up next
            </SectionLabel>
            <Row
              dot={<Dot color={upNext.color} />}
              title={String((upNext.payload as { title?: string }).title ?? "Untitled")}
              meta={countdownLabel(now, new Date(upNext.starts_at!))}
              first
              ink={ink}
            />
          </>
        )}

        {todos.length > 0 && (
          <>
            <SectionLabel className="mt-[32px]" ink={ink}>
              Tasks
            </SectionLabel>
            {todos.slice(0, MAX_ROWS).map((t, i) => {
              const done = t.status === "done";
              const person = (t.payload as { person?: string }).person;
              return (
                <Row
                  key={t.id}
                  dot={done ? <Dot color={t.color} /> : <Ring color={t.color} />}
                  title={String((t.payload as { title?: string }).title ?? "Untitled")}
                  meta={[person, done ? "done" : null].filter(Boolean).join(" · ")}
                  first={i === 0 && !done}
                  dimmed={done}
                  ink={ink}
                />
              );
            })}
            {todos.length > MAX_ROWS && <More count={todos.length - MAX_ROWS} ink={ink} />}
          </>
        )}

        {/* The foot of the column. `mt-auto` drops it to the bottom-left on an
            ordinary day and lets it ride up on a busy one, rather than being
            pinned and overrun — the same way the board's ledger ends. */}
        <div className="mt-auto flex items-end gap-[22px] pt-[16px]">
          {starBank && (
            <div className="flex-1">
              <StarBankView bank={starBank} tone={STAR_TONE} scale={COLUMN_SCALE} />
            </div>
          )}

          {/* Nearly invisible by design — never style this up. Set in the foot's
              empty top corner rather than under the column: it costs no height,
              and a stray dot below ten stepping stones would read as an
              eleventh, or beside the plate as part of the reward. */}
          <span
            className="block h-2 w-2 shrink-0 self-start rounded-full"
            style={{ background: "hsl(36 20% 80% / 0.25)", opacity: live ? 0.25 : 0.5 }}
            title={live ? "Live (Realtime)" : "Demo data"}
          />
        </div>
      </div>

      <StalenessNotice freshness={freshness} tone="dark" />
    </>
  );
}

type Ink = { base: string; soft: string; dim: string; faint: string; accent: string };

function ClockLine({ now, ink }: { now: Date; ink: Ink }) {
  const { clock, meridiem } = fmtClock(now);
  return (
    <div className="mt-4 flex items-baseline gap-4">
      <span
        className={`font-display text-time leading-none tabular-nums ${ink.base}`}
        style={{ letterSpacing: "-0.01em" }}
      >
        {clock}
      </span>
      {meridiem && (
        <span className={`font-display text-meridiem leading-none font-light ${ink.dim}`}>
          {meridiem}
        </span>
      )}
    </div>
  );
}

function SectionLabel({
  children,
  className = "",
  ink,
}: {
  children: React.ReactNode;
  className?: string;
  ink: Ink;
}) {
  return (
    <div
      className={`font-text text-label leading-none font-semibold uppercase ${ink.dim} ${className}`}
      style={{ letterSpacing: "0.24em" }}
    >
      {children}
    </div>
  );
}

function Row({
  dot,
  title,
  meta,
  first,
  dimmed,
  ink,
}: {
  dot: React.ReactNode;
  title: string;
  meta: string;
  first: boolean;
  dimmed?: boolean;
  ink: Ink;
}) {
  return (
    <div
      className={`flex items-baseline gap-[14px] ${first ? "mt-5" : "mt-4"}`}
      style={dimmed ? { opacity: 0.4 } : undefined}
    >
      {dot}
      <span className={`font-display text-row-title leading-[1.25] ${first ? ink.base : ink.soft}`}>
        {title}
        {meta && (
          <span className={`font-text text-meta ml-[8px] leading-none ${ink.dim}`}> {meta}</span>
        )}
      </span>
    </div>
  );
}

function Dot({ color }: { color: string | null }) {
  return (
    <span
      className="h-[11px] w-[11px] shrink-0 rounded-full"
      style={{ background: color ?? "var(--color-person-clay)", transform: "translateY(-2px)" }}
      aria-hidden
    />
  );
}

/** An open task reads as an unfilled ring; done fills it in. No checkboxes. */
function Ring({ color }: { color: string | null }) {
  return (
    <span
      className="box-border h-[11px] w-[11px] shrink-0 rounded-full border-2"
      style={{ borderColor: color ?? "var(--color-person-clay)", transform: "translateY(-1px)" }}
      aria-hidden
    />
  );
}

function More({ count, ink }: { count: number; ink: Ink }) {
  return <div className={`font-text text-meta mt-4 leading-none ${ink.faint}`}>+ {count} more</div>;
}
