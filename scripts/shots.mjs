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
 * Photos come from `dev-photos/` (gitignored — see docs/PHOTO-PROMPTS.md for how
 * to generate some). Each shot names the photo(s) it wants; the dev server bakes
 * VITE_DEV_PHOTO_URL in at boot, so shots are grouped by photo set and the server
 * is restarted once per group. A missing photo is not fatal: the wall falls back
 * to its solid no-photo rendering, which is a real supported state.
 *
 * A shot may name SEVERAL photos. Side veil uses only the first (it is a
 * full-bleed background), but Oat & moss leans up to three as a mantelpiece, and
 * with fewer than three the empty slots simply don't render — so shooting that
 * board with one photo silently misrepresents it. First listed is the hero
 * frame, and `url|caption` captions it.
 *
 * The browser clock and timezone are pinned so the output is reproducible —
 * same commit, same pixels. (It used to be load-bearing for correctness too:
 * the wall clock was formatted from the host zone while everything beside it
 * used HOME_TZ, so an unpinned run could render "GOOD MORNING" above an
 * afternoon clock. `fmtClock` fixed that; the pin now only buys determinism.)
 */
import { spawn } from "node:child_process";
import { mkdir, access } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "docs/screenshots");
const PORT = 5177;
const BASE = `http://localhost:${PORT}`;
const TZ = "America/Los_Angeles";
const WHEN = new Date("2026-08-13T18:12:00-07:00"); // a summer evening

/**
 * The shots, each naming the photo it hangs on. `photo` is a filename inside
 * dev-photos/, or null for the solid no-photo wall.
 */
const SHOTS = [
  // The wall, 16:9. The stage is fixed at 1920×1080 and scales to fit, so 1600
  // wide is the same composition at a third of the file size.
  { file: "wall-side-veil.jpg", photos: ["garden.jpg"], w: 1600, h: 900, type: "jpeg" },
  {
    // The tenth star. Boot one short of the goal, then cross it live — the burst
    // deliberately does NOT fire on a wall that merely booted into a full row,
    // so the threshold has to be crossed while the page is watching.
    file: "wall-celebration.jpg",
    photos: ["garden.jpg"],
    w: 1600,
    h: 900,
    stars: 9,
    type: "jpeg",
    cross: true,
  },
  { file: "phone.png", photos: ["garden.jpg"], route: "/", w: 430, h: 846 },
  // The same wall on a different photo — what the rotation actually looks like,
  // and proof the veil holds its contrast against a dark image as well as a
  // bright one.
  { file: "wall-side-veil-dusk.jpg", photos: ["beach.jpg"], w: 1600, h: 900, type: "jpeg" },
  // Oat & moss hangs its photo in a frame — a CENTRE crop — while the veil
  // photos are composed with their subject far right, so the mount clips the
  // family out of its own picture. Verified against two different images: it is
  // the crop, not the photo. So this one gets a pre-cropped, portrait-ish file
  // whose subject already sits centre. Same scene, framed for the mount.
  // All three, because the mantelpiece is a trio — one photo renders one lonely
  // print and reads as a bug. Hero first, and it is the only frame captioned.
  {
    file: "wall-oat-moss.jpg",
    photos: ["kitchen-crop.jpg|Pancake Saturday", "garden-crop.jpg", "beach-crop.jpg"],
    w: 1600,
    h: 900,
    layout: "oat-moss",
    type: "jpeg",
  },
];

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

const win = process.platform === "win32";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const listening = async () => {
  try {
    return (await fetch(`${BASE}/tv`)).ok;
  } catch {
    return false;
  }
};

/**
 * Stop a dev server and wait for the port to actually close.
 *
 * `spawn("npx", …).kill()` signals npx, not the vite process it execs, so the
 * server survives and keeps the port. The next start then fails on
 * --strictPort while the old server answers the readiness probe — which
 * silently captures every later shot against the PREVIOUS photo. Hence the
 * process group (detached + negative pid) and the wait for the port to free.
 */
const stopVite = async (proc) => {
  try {
    if (win) proc.kill();
    else process.kill(-proc.pid, "SIGTERM");
  } catch {
    /* already gone */
  }
  for (let i = 0; i < 40; i++) {
    if (!(await listening())) return;
    await sleep(250);
  }
  throw new Error(`Dev server on :${PORT} would not shut down`);
};

const startVite = async (photos) => {
  if (await listening()) throw new Error(`Something is already on :${PORT}`);
  // Each item may carry a `|caption`, which must stay attached to its url.
  const value = (photos ?? [])
    .map((item) => {
      const [file, caption] = item.split("|");
      return caption ? `/dev-photos/${file}|${caption}` : `/dev-photos/${file}`;
    })
    .join(",");
  const proc = spawn("npx", ["vite", "--port", String(PORT), "--strictPort"], {
    cwd: ROOT,
    env: { ...process.env, VITE_DEV_PHOTO_URL: value },
    stdio: "ignore",
    shell: win,
    detached: !win,
  });
  for (let i = 0; i < 60; i++) {
    if (proc.exitCode !== null) throw new Error("Dev server exited before it was ready");
    if (await listening()) return proc;
    await sleep(500);
  }
  await stopVite(proc);
  throw new Error(`Dev server never came up on :${PORT}`);
};

await mkdir(OUT, { recursive: true });

// Group by photo SET so the dev server restarts once per set, not once per shot.
const groups = new Map();
for (const s of SHOTS) {
  const key = (s.photos ?? []).join(",");
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(s);
}

const browser = await chromium.launch();

for (const [key, shots] of groups) {
  // Drop any missing file rather than failing: a fork with no photos still gets
  // a full set of screenshots, just on the solid wall.
  const wanted = key ? key.split(",") : [];
  const use = [];
  for (const item of wanted) {
    const [file] = item.split("|");
    try {
      await access(path.join(ROOT, "dev-photos", file));
      use.push(item);
    } catch {
      console.warn(`! dev-photos/${file} not found — skipping it`);
    }
  }

  const vite = await startVite(use);
  for (const s of shots) {
    const ctx = await browser.newContext({ viewport: { width: s.w, height: s.h }, timezoneId: TZ });
    const page = await ctx.newPage();
    await page.clock.setFixedTime(WHEN);
    await page.addInitScript(
      ([l, b]) => {
        localStorage.setItem("mantel_setting_tv_layout", JSON.stringify(l));
        localStorage.setItem("mantel_setting_star_bank", b);
      },
      [s.layout ?? "side-veil", bank(s.stars ?? 6)],
    );
    await page.goto(BASE + (s.route ?? "/tv"), { waitUntil: "networkidle" });
    await page.waitForTimeout(2500); // photo decode + Ken Burns settle

    if (s.cross) {
      await page.evaluate((full) => {
        localStorage.setItem("mantel_setting_star_bank", full);
        window.dispatchEvent(
          new StorageEvent("storage", { key: "mantel_setting_star_bank", newValue: full }),
        );
      }, bank(10));
      await page.waitForTimeout(1400); // mid-burst
    }

    await page.screenshot({
      path: path.join(OUT, s.file),
      ...(s.type === "jpeg" ? { type: "jpeg", quality: 92 } : {}),
    });
    console.log(`✓ ${s.file}${use.length ? `  (${use.map((u) => u.split("|")[0]).join(", ")})` : "  (no photo)"}`);
    await ctx.close();
  }
  await stopVite(vite);
}

await browser.close();
console.log(`\nWrote to ${OUT}`);
