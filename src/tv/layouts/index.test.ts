import { describe, it, expect } from "vitest";
import { LAYOUTS, DEFAULT_LAYOUT_ID, resolveLayout } from "./index";

describe("layout registry", () => {
  it("resolves a known id to its layout", () => {
    expect(resolveLayout("side-veil").id).toBe("side-veil");
    expect(resolveLayout("oat-moss").id).toBe("oat-moss");
    expect(resolveLayout("oat-moss-stack").id).toBe("oat-moss-stack");
  });

  it("falls back to the default for anything unrecognised", () => {
    // The wall must never be breakable by a bad setting value — RLS lets any
    // family member write, so a typo, a future-version id, or a garbage write
    // has to degrade to the default rather than blank the wall.
    for (const bad of [null, undefined, "", "nope", 42, {}, [], "SIDE-VEIL"]) {
      expect(resolveLayout(bad).id).toBe(DEFAULT_LAYOUT_ID);
    }
  });

  it("keeps the default as the first entry", () => {
    expect(LAYOUTS[0].id).toBe(DEFAULT_LAYOUT_ID);
    expect(DEFAULT_LAYOUT_ID).toBe("side-veil");
  });

  it("gives every layout the fields the picker needs", () => {
    for (const l of LAYOUTS) {
      expect(l.id).toBeTruthy();
      expect(l.label).toBeTruthy();
      expect(l.description).toBeTruthy();
      expect(typeof l.Component).toBe("function");
    }
  });
});
