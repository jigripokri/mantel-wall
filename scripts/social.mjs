/**
 * Render docs/social/templates.html into shareable images.
 *
 *   node scripts/social.mjs
 *
 * Needs Playwright, same as scripts/shots.mjs — a dev tool, not a dependency:
 *   npm i -D playwright && npx playwright install chromium
 *
 * Run scripts/shots.mjs first: the templates embed the README screenshots, so
 * a new photo flows through to the social assets automatically.
 */
import { chromium } from "playwright";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC = pathToFileURL(path.join(ROOT, "docs/social/templates.html")).href;
const OUT = path.join(ROOT, "docs/social");

/** id in templates.html → output file. Sizes come from the CSS, not from here. */
const FRAMES = [
  ["linkedin-hero", "linkedin-hero.jpg"],
  ["og", "og-card.jpg"],
  ["c1", "carousel-1.jpg"],
  ["c2", "carousel-2.jpg"],
  ["c3", "carousel-3.jpg"],
  ["c4", "carousel-4.jpg"],
  ["c5", "carousel-5.jpg"],
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1200 }, deviceScaleFactor: 1 });
await page.goto(SRC, { waitUntil: "networkidle" });
// Webfonts decide the layout here — capturing before they land shifts every line.
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(600);

for (const [id, file] of FRAMES) {
  const el = page.locator(`#${id}`);
  await el.screenshot({ path: path.join(OUT, file), type: "jpeg", quality: 92 });
  const box = await el.boundingBox();
  console.log(`✓ ${file}  ${Math.round(box.width)}×${Math.round(box.height)}`);
}

await browser.close();
console.log(`\nWrote to ${OUT}`);
