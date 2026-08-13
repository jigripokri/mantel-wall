import type { Entry } from "../../lib/types";
import { fmtTime } from "../../lib/time";

export function CalendarTile({ entry }: { entry: Entry }) {
  const p = entry.payload as { title?: string; location?: string; person?: string };
  const allDay = (entry.payload as { allDay?: boolean }).allDay;
  return (
    <li className="flex items-start gap-4 py-4">
      <span
        className="mt-2 h-3 w-3 shrink-0 rounded-full"
        style={{ background: entry.color ?? "var(--color-gold)" }}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-4">
          <span className="truncate text-2xl font-medium text-[var(--color-ink)]">
            {p.title ?? "Untitled"}
          </span>
          <span className="shrink-0 font-display text-xl text-[var(--color-gold)]">
            {allDay ? "All day" : fmtTime(entry.starts_at)}
          </span>
        </div>
        {(p.location || p.person) && (
          <div className="mt-1 text-lg text-[var(--color-ink-dim)]">
            {[p.person, p.location].filter(Boolean).join(" · ")}
          </div>
        )}
      </div>
    </li>
  );
}
