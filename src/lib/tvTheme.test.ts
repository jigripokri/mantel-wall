import { describe, it, expect } from "vitest";
import { isDarkSkin } from "./tvTheme";

describe("isDarkSkin", () => {
  it("auto follows the clock", () => {
    expect(isDarkSkin("auto", true)).toBe(true); // night → dark
    expect(isDarkSkin("auto", false)).toBe(false); // day → light
  });

  it("dark forces the dark skin even during the day", () => {
    expect(isDarkSkin("dark", false)).toBe(true);
    expect(isDarkSkin("dark", true)).toBe(true);
  });

  it("light forces the light skin even at night", () => {
    expect(isDarkSkin("light", true)).toBe(false);
    expect(isDarkSkin("light", false)).toBe(false);
  });
});
