/**
 * The wall's skin preference, set from the phone (`tv_theme` app setting).
 *
 * The Oat & moss board normally follows the clock — oat by day, walnut after
 * dark. This lets the family override that: force the dark (walnut) skin all day,
 * or the light one at night. Only the *skin* is forced; things that report the
 * actual time of day (the greeting, the agenda heading, the sun-vs-moon weather
 * mark) still follow the real clock, so "dark by day" reads as a dim room, not a
 * lie about whether the sun is up. Side veil is always dark, so this is a no-op
 * there.
 */
export type TvTheme = "auto" | "dark" | "light";

export const TV_THEME_DEFAULT: TvTheme = "auto";

/** Should the wall render its dark (evening) skin? `auto` follows the clock. */
export function isDarkSkin(theme: TvTheme, nightByClock: boolean): boolean {
  if (theme === "dark") return true;
  if (theme === "light") return false;
  return nightByClock;
}
