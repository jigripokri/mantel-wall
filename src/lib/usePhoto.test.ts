import { describe, it, expect } from "vitest";
import { photoSetKey, reconcileShown, rotateSlot } from "./usePhoto";
import type { Entry } from "./types";

const photoEntry = (id: string, created: string): Entry =>
  ({
    id,
    type: "photo",
    source: "phone",
    created_at: created,
    updated_at: created,
    starts_at: null,
    ends_at: null,
    due_at: null,
    expires_at: null,
    status: "active",
    color: null,
    external_id: null,
    created_by: null,
    pinned: false,
    sort_order: 0,
    payload: {},
    media_key: `photos/${id}.jpg`,
  }) as Entry;

describe("photoSetKey — the signature that gates the rotation timer", () => {
  it("is identical for the same set in a different order", () => {
    // Photos share a null starts_at, so a refetch can hand the same set back
    // reordered; if that changed the key it would restart the rotation timer
    // every poll and the hourly rotation would never fire.
    const a = photoEntry("a", "2026-07-25T01:00:00Z");
    const b = photoEntry("b", "2026-07-25T02:00:00Z");
    const c = photoEntry("c", "2026-07-25T03:00:00Z");
    expect(photoSetKey([a, b, c])).toBe(photoSetKey([c, a, b]));
  });

  it("changes when a photo is added or removed", () => {
    const a = photoEntry("a", "2026-07-25T01:00:00Z");
    const b = photoEntry("b", "2026-07-25T02:00:00Z");
    expect(photoSetKey([a, b])).not.toBe(photoSetKey([a]));
  });
});

describe("reconcileShown — keeping the shown set valid and full", () => {
  it("fills from the newest on the first pass", () => {
    expect(reconcileShown([], ["a", "b", "c", "d"], 3)).toEqual(["a", "b", "c"]);
  });

  it("drops ids that no longer exist and refills, keeping the rest in place", () => {
    // "x" was removed from the library; the gap is filled from the newest unshown.
    expect(reconcileShown(["b", "x", "c"], ["a", "b", "c", "d"], 3)).toEqual(["b", "c", "a"]);
  });

  it("shows everything when there are fewer photos than slots", () => {
    expect(reconcileShown([], ["a", "b"], 3)).toEqual(["a", "b"]);
    expect(reconcileShown(["a", "b"], ["a", "b"], 3)).toEqual(["a", "b"]);
  });

  it("leaves an already-full, still-valid set untouched", () => {
    expect(reconcileShown(["a", "b", "c"], ["a", "b", "c", "d"], 3)).toEqual(["a", "b", "c"]);
  });

  it("admits a fresh upload straight into the hero frame, other frames unmoved", () => {
    // n is the newest, so it leads orderedIds. Slots 1 and 2 keep their photos
    // AND their positions — the upload reads as one dissolve, not a reshuffle.
    expect(reconcileShown(["a", "b", "c"], ["n", "a", "b", "c"], 3, ["n"])).toEqual(["n", "b", "c"]);
  });

  it("admits several fresh uploads from the front, newest in the hero", () => {
    expect(reconcileShown(["a", "b", "c"], ["n1", "n2", "a", "b", "c"], 3, ["n1", "n2"])).toEqual([
      "n1",
      "n2",
      "c",
    ]);
  });

  it("ignores a fresh id already on screen", () => {
    expect(reconcileShown(["a", "b", "c"], ["a", "b", "c", "d"], 3, ["a"])).toEqual(["a", "b", "c"]);
  });

  it("keeps a partial row when admitting fresh, then fills", () => {
    expect(reconcileShown(["a"], ["n", "a", "b"], 3, ["n"])).toEqual(["n", "a", "b"]);
  });
});

describe("rotateSlot — one frame drifts at a time", () => {
  const order = ["a", "b", "c", "d", "e"];

  it("swaps the named slot for the next off-screen photo, advancing the cursor", () => {
    const r = rotateSlot(["a", "b", "c"], order, 0, 3);
    expect(r.shown).toEqual(["d", "b", "c"]);
    expect(r.cursor).toBe(4);
  });

  it("skips photos already on screen so a photo never shows twice at once", () => {
    // cursor starts at 0 (a,b,c all on screen) → first free is "d".
    const r = rotateSlot(["a", "b", "c"], order, 1, 0);
    expect(r.shown).toEqual(["a", "d", "c"]);
    expect(new Set(r.shown).size).toBe(3);
  });

  it("does nothing when there's nothing off-screen to bring in", () => {
    const r = rotateSlot(["a", "b", "c"], ["a", "b", "c"], 0, 0);
    expect(r.shown).toEqual(["a", "b", "c"]);
  });

  it("cycles slots round-robin: every photo gets time, none ever duplicated", () => {
    let shown = ["a", "b", "c"];
    let cursor = 3;
    const seen = new Set(shown);
    for (let tick = 0; tick < 12; tick++) {
      const frame = tick % 3;
      const r = rotateSlot(shown, order, frame, cursor);
      shown = r.shown;
      cursor = r.cursor;
      expect(new Set(shown).size).toBe(3); // never two frames on the same photo
      shown.forEach((id) => seen.add(id));
    }
    expect(seen).toEqual(new Set(order)); // all five have appeared
  });
});
