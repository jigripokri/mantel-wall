import { useMemo } from "react";
import { useEntries } from "../lib/useEntries";
import { useFreshness } from "../lib/useFreshness";
import { useNow } from "../lib/useNow";
import { usePhotos } from "../lib/usePhoto";
import { useSetting } from "../lib/useSetting";
import { selectAgenda, selectTodos, selectUpNext } from "../lib/agenda";
import { DEFAULT_STAR_BANK, type StarBank } from "../lib/starBank";
import { TV_THEME_DEFAULT, type TvTheme } from "../lib/tvTheme";
import { Stage } from "./Stage";
import { StarCelebration, useGoalCelebration } from "./StarCelebration";
import { WallGate } from "../auth/SignIn";
import { resolveLayout, DEFAULT_LAYOUT_ID } from "./layouts";
import { calendarModule } from "../modules/calendar/index.tsx";
import { weatherModule } from "../modules/weather/index.tsx";

/**
 * The wall — a thin shell. It owns everything layout-independent: the auth gate,
 * the loading surface, the Stage, the data selection, and which layout is active
 * (a phone-writable setting). The chosen layout component does all the rendering.
 *
 * Layouts live in ./layouts and are switched from the phone route via the
 * `tv_layout` app setting; see the plan and 0006_app_settings.sql.
 */
export function TvWall() {
  const now = useNow();
  const { entries, live, authed, loading } = useEntries();
  const freshness = useFreshness(authed);
  const photos = usePhotos(entries, 3);
  const layout = useSetting("tv_layout", DEFAULT_LAYOUT_ID);
  const starBank = useSetting<StarBank>("star_bank", DEFAULT_STAR_BANK);
  const theme = useSetting<TvTheme>("tv_theme", TV_THEME_DEFAULT);
  // The tenth star, on every skin — the burst is layout-independent, like the
  // gate and the Stage. Armed only once the row has actually loaded, so a wall
  // rebooting into a full week doesn't re-throw a party it already threw.
  const celebrating = useGoalCelebration(starBank.value, !starBank.loading);

  const events = useMemo(
    () => entries.filter((e) => calendarModule.showOnTv?.(e, now) ?? true),
    [entries, now],
  );
  const agenda = useMemo(() => selectAgenda(events, now), [events, now]);
  const todos = useMemo(() => selectTodos(entries), [entries]);
  // Exclude what the agenda already shows so Up next is always something new.
  const upNext = useMemo(
    () => selectUpNext(events, now, new Set(agenda.rows.map((r) => r.id))),
    [events, now, agenda],
  );
  const weather = entries.find((e) => weatherModule.showOnTv?.(e, now));

  // Every hook above runs unconditionally; the gate sits here so the rules of
  // hooks hold. While the session resolves we paint the bare surface rather than
  // the sign-in form — a wall that flashes "signed out" on every reboot before
  // restoring itself looks broken from across a room.
  if (!authed) {
    return loading ? (
      <Stage>
        <div className="absolute inset-0 bg-[var(--color-wall)]" />
      </Stage>
    ) : (
      <Stage>
        <WallGate />
      </Stage>
    );
  }

  const Layout = resolveLayout(layout.value).Component;

  return (
    <Stage kiosk>
      <Layout
        now={now}
        agenda={agenda}
        todos={todos}
        upNext={upNext}
        starBank={starBank.value}
        weather={weather}
        photos={photos}
        theme={theme.value}
        live={live}
        freshness={freshness}
      />
      {celebrating && <StarCelebration bank={starBank.value} />}
    </Stage>
  );
}
