/**
 * Regenerate the README screenshots from the real app on mock data.
 *
 *   node scripts/shots.mjs
 *
 * Playwright is deliberately NOT a dependency of this project — it would add a
 * browser download to every `npm install` for a tool almost nobody runs. Install
 * it when you need it:
 *
 *   npm i -D playwright && npx playwright install chromium
 *
 * Set a photo first if you want one behind the wall (see docs/PHOTO-PROMPTS.md):
 *
 *   MANTEL_PHOTO=/dev-photos/your-photo.jpg node scripts/shots.mjs
 *
 * The browser clock and timezone are both pinned. That is load-bearing, not
 * tidiness: the wall clock is formatted from the host zone while the greeting
 * and date line use HOME_TZ, so an unpinned run can produce a screenshot
 * reading "GOOD MORNING" above an afternoon clock.
 */
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const OUT = path.resolve(import.meta.dirname, "../docs/screenshots");
const PORT = 5177;
const BASE = `http://localhost:${PORT}`;
const TZ = "America/Los_Angeles";
const WHEN = new Date("2026-08-13T18:12:00-07:00"); // a summer evening
const PHOTO = process.env.MANTEL_PHOTO ?? "";

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.error("This script needs Playwright:\n  npm i -D playwright && npx playwright install chromium");
  process.exit(1);
}

/** A star bank mid-week, tinted across the configured people. */
const bank = (stars) =>
  JSON.stringify({
    name: "Robin",
    stars,
    goal: 10,
    givers: Array.from({ length: stars }, (_, i) => (i % 3 === 0 ? "person-1" : "person-2")),
    log: [],
    reward: { icon: "🍦", label: "Ice cream" },
  });

await mkdir(OUT, { recursive: true });

const vite = spawn("npx", ["vite", "--port", String(PORT), "--strictPort"], {
  cwd: path.resolve(import.meta.dirname, ".."),
  env: { ...process.env, VITE_DEV_PHOTO_URL: PHOTO },
  stdio: "ignore",
  shell: process.platform === "win32",
});

const up = async () => {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`${BASE}/tv`);
      if (r.ok) return true;
    } catch {
      /* not listening yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
};

if (!(await up())) {
  vite.kill();
  console.error(`Dev server never came up on :${PORT}`);
  process.exit(1);
}

const browser = await chromium.launch();

async function shot({ file, route = "/tv", w, h, layout = "side-veil", stars = 6, type, after }) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, timezoneId: TZ });
  const page = await ctx.newPage();
  await page.clock.setFixedTime(WHEN);
  await page.addInitScript(
    ([l, b]) => {
      localStorage.setItem("mantel_setting_tv_layout", JSON.stringify(l));
      localStorage.setItem("mantel_setting_star_bank", b);
    },
    [layout, bank(stars)],
  );
  await page.goto(BASE + route, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500); // photo decode + Ken Burns settle
  if (after) await after(page);
  await page.screenshot({
    path: path.join(OUT, file),
    ...(type === "jpeg" ? { type: "jpeg", quality: 92 } : {}),
  });
  console.log("✓", file);
  await ctx.close();
}

// The wall, 16:9. The stage is fixed at 1920×1080 and scales to fit, so 1600
// wide is the same composition at a third of the file size.
await shot({ file: "wall-side-veil.jpg", w: 1600, h: 900, type: "jpeg" });
await shot({ file: "wall-oat-moss.jpg", w: 1600, h: 900, layout: "oat-moss", type: "jpeg" });

// The tenth star. Boot one short of the goal, then cross it live — the burst
// deliberately does NOT fire on a wall that merely booted into a full row, so
// the threshold has to actually be crossed while the page is watching.
await shot({
  file: "wall-celebration.jpg",
  w: 1600,
  h: 900,
  stars: 9,
  type: "jpeg",
  after: async (page) => {
    await page.evaluate((full) => {
      localStorage.setItem("mantel_setting_star_bank", full);
      window.dispatchEvent(
        new StorageEvent("storage", { key: "mantel_setting_star_bank", newValue: full }),
      );
    }, bank(10));
    await page.waitForTimeout(1400); // mid-burst
  },
});

await shot({ file: "phone.png", route: "/", w: 430, h: 846 });

await browser.close();
vite.kill();
console.log(`\nWrote to ${OUT}`);
