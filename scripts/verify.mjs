#!/usr/bin/env node
// The self-check gate for autonomous build loops. A session is "done" only when
// this passes. Runs typecheck → lint → build, stops at the first failure, and
// prints a copyable summary. See CLAUDE.md § Verify-before-commit.
import { spawnSync } from "node:child_process";

// Invoke the local .bin tools directly so we don't depend on `npm.cmd` launch
// semantics (which changed on Node 25 / Windows for .cmd shims).
const steps = [
  ["typecheck", "tsc -b --noEmit"],
  ["lint", "eslint ."],
  // `vitest run`, never bare `vitest` — watch mode would hang an autonomous loop
  // forever. Runs every suite twice, under TZ=UTC and TZ=America/Los_Angeles.
  ["test", "vitest run"],
  ["build", "vite build"],
];

let failed = null;

for (const [name, cmd] of steps) {
  process.stdout.write(`\n▶ ${name}\n`);
  // shell:true lets Windows resolve the .cmd shim in node_modules/.bin. Pass the
  // whole command as one string (no separate args) to avoid the Node shell warning.
  const r = spawnSync(cmd, { stdio: "inherit", shell: true });
  if (r.status !== 0) {
    failed = name;
    break;
  }
}

if (failed) {
  console.error(`\n✗ verify failed at: ${failed}`);
  process.exit(1);
}
console.log("\n✓ verify passed (typecheck · lint · test · build)");
