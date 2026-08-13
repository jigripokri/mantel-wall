import { SideVeil } from "./SideVeil";
import { OatMoss, OatMossStack } from "./OatMoss";
import type { LayoutEntry } from "./types";

/**
 * The wall's layouts, in the order the phone picker shows them. The first is the
 * default and the fallback for any unrecognised setting value.
 */
export const LAYOUTS: LayoutEntry[] = [
  {
    id: "side-veil",
    label: "Side veil",
    description: "One photo, dark, a quiet column of type. The original.",
    Component: SideVeil,
  },
  {
    id: "oat-moss",
    label: "Oat & moss",
    description: "A daylight family board; goes walnut after dark.",
    Component: OatMoss,
  },
  {
    id: "oat-moss-stack",
    label: "The stack",
    description: "The board with one photo forward and two peeking behind.",
    Component: OatMossStack,
  },
];

export const DEFAULT_LAYOUT_ID = LAYOUTS[0].id;

/**
 * Map a stored setting value to a layout, falling back to the default for
 * anything unrecognised — a null, a typo, a value from a future version, or a
 * garbage write. The wall can therefore never be broken by a bad setting; the
 * worst a bad value does is show the default. This is the guarantee the RLS
 * write policy leans on, so it is unit-tested.
 */
export function resolveLayout(value: unknown): LayoutEntry {
  const match = typeof value === "string" && LAYOUTS.find((l) => l.id === value);
  return match || LAYOUTS[0];
}
