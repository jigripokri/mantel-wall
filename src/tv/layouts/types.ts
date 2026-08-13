import type { FC } from "react";
import type { Entry } from "../../lib/types";
import type { Agenda } from "../../lib/agenda";
import type { Photo } from "../../lib/usePhoto";
import type { Freshness } from "../../lib/useFreshness";
import type { StarBank } from "../../lib/starBank";
import type { TvTheme } from "../../lib/tvTheme";

/**
 * Everything a wall layout needs, computed once in TvWall and handed to the
 * active layout. Layouts are purely presentational — they receive this and
 * render; they do not fetch or select.
 */
export type WallData = {
  now: Date;
  agenda: Agenda;
  todos: Entry[];
  /** The next notable (non-routine) event to keep an eye out for, or null. */
  upNext: Entry | null;
  /** The child's star bank — the board layout shows it; null hides the section. */
  starBank: StarBank | null;
  weather: Entry | undefined;
  /** Newest first. Side veil uses only the first; the board hangs up to three. */
  photos: Photo[];
  /** Wall skin preference (phone-set). The board honours it; Side veil is dark. */
  theme: TvTheme;
  /** Realtime-connected (vs mock data) — drives the near-invisible status dot. */
  live: boolean;
  freshness: Freshness;
};

export type WallLayout = FC<WallData>;

export type LayoutEntry = {
  id: string;
  /** Shown in the phone picker. */
  label: string;
  description: string;
  Component: WallLayout;
};
