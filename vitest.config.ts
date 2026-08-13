import { defineConfig } from "vitest/config";

/**
 * Every suite runs TWICE, under two different host timezones.
 *
 * This is the load-bearing guarantee for calendar ingest. The parser runs in two
 * places — the Deno Edge Function (UTC, us-west-2) and the Pi's browser (Pacific)
 * — and ical.js ships no tzdata, so an unresolved TZID silently falls back to
 * *runtime local*. That would make the two disagree about what instant an event
 * starts at, and no typecheck or lint would ever catch it.
 *
 * Pinning the host zone per project turns every assertion into a divergence
 * test: any value that leaks runtime-local time fails in exactly one project.
 * `pool: "forks"` is required — TZ must be set before the runtime starts, which
 * worker threads do not honour.
 */
const projectFor = (name: string, tz: string) => ({
  test: {
    name,
    env: { TZ: tz },
    // .tsx too: the star celebrations are only ever on screen for seconds a week,
    // so what the wall emits when a row fills is asserted by rendering it.
    include: ["src/**/*.test.{ts,tsx}"],
    pool: "forks" as const,
  },
});

export default defineConfig({
  test: {
    projects: [
      projectFor("tz-utc", "UTC"),
      projectFor("tz-pacific", "America/Los_Angeles"),
    ],
  },
});
