import type { FeatureModule } from "../lib/types";
import { calendarModule } from "./calendar/index.tsx";
import { weatherModule } from "./weather/index.tsx";

/**
 * The registry. Adding a feature = one module file + one line here (+ one cron
 * line if it ingests). Order is not significant; the wall composes by `layer`.
 *   v1 — calendar, weather   (ingest)
 *   v2 — todos               (ingest + phone check-off)   see tasks/v2-todos.md
 *   v3 — photos              (contribution / upload)       see tasks/v3-photos.md
 */
export const MODULES: FeatureModule[] = [calendarModule, weatherModule];

export function moduleFor(type: string): FeatureModule | undefined {
  return MODULES.find((m) => m.type === type);
}
