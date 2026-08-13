# Mantel — working notes

A family portal on a wall-mounted TV (driven by a Raspberry Pi kiosk). One React
SPA, two routes: **`/tv`** (the wall) and **`/`** (family phones). Backend is
**Supabase** (Postgres + RLS + Auth + Storage + Realtime + Edge Functions) —
there is **no server to write**.

Read [`MODULES.md`](MODULES.md) before touching a feature. It's the contract the
whole app is built on.

## Stack

React 19 + Vite + TypeScript + Tailwind v4 · `@supabase/supabase-js` ·
react-router. Edge Functions are Deno.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server on :5000 (serves `/tv` and `/`). |
| `npm run build` | `tsc -b` + Vite production build → `dist/`. |
| `npm run check` | Typecheck only (`tsc -b --noEmit`). |
| `npm run lint` | ESLint. |
| `npm run test` | Vitest. Every suite runs twice — `TZ=UTC` and `TZ=America/Los_Angeles`. |
| **`npm run verify`** | **typecheck → lint → test → build. The build-loop gate.** |
| `npm run db:push` | `supabase db push` — migrates whatever project is linked. |

Preview during a session: `.claude/launch.json` defines the `mantel` server, so
`preview_start` boots it on :5000. `/tv` is the wall; `/` is the phone view.

## Runs without a cloud account

`HAS_SUPABASE` is false unless `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` are
set. When false, [`useEntries`](src/lib/useEntries.ts) serves deterministic mock
data ([`src/lib/mockData.ts`](src/lib/mockData.ts)) so the entire UI is buildable
and reviewable before Supabase exists. This is intentional — **keep it working.**
It is how a new fork is evaluated, and how every UI change is reviewed.

## One file holds every name

[`src/config/family.ts`](src/config/family.ts) is the only place a person is
named. Nothing else in `src/` may hardcode a family member, a child's name, a
home location, or a sign-in email. Tests address people through `FAMILY.people`
rather than by literal, so a fork that renames its family stays green.

Sign-in emails are the exception that proves the rule: they are **not** in that
file, because it compiles into the public JS bundle. The email → person link is
made at runtime from the RLS-gated `family_members` table by
[`useFamily`](src/lib/useFamily.ts).

## The build loop (this repo is optimized for autonomous sessions)

Each feature slice is a self-contained task under [`tasks/`](tasks/). A session:

1. Reads `MODULES.md` + the relevant `tasks/<slice>.md`.
2. Uses **plan mode** before large steps; **checkpoints** to rewind.
3. Edits only through Claude Code (**one editor** — never hand-edit elsewhere).
4. **Verify-before-commit:** `npm run verify` must pass, then preview `/tv` and
   `/` in the browser panel and confirm the change is visible. A slice is "done"
   only when verify is green *and* the wall looks right.
5. Commits with a message naming the slice; pushes.

`tasks/` holds the ladder — `v1-calendar.md`, `v2-todos.md`, `v3-photos.md` —
plus `v0-setup.md` (personalize a fresh fork) and `TEMPLATE.md` for new slices.

## Gotchas

- **Idempotent sync.** Synced rows upsert on `(source, external_id)`. Never
  blind-insert. See `MODULES.md`.
- **Shared ingest code lives under `supabase/functions/_shared/`**, not in `src/`
  — the Supabase CLI must never bundle imports from outside the functions root.
  Files there are named explicitly in `tsconfig.app.json` and un-ignored in
  `eslint.config.js`; miss that and they escape both gates. For the same reason
  `_shared/` may **not** import `src/config/family.ts` — ingest gets its people
  from the `PEOPLE` Edge Function secret instead.
- **Never read runtime-local time in shared code.** Ingest runs in Deno (UTC) and
  the wall runs on the Pi. Anything derived from the host zone diverges between
  them silently — hence the two-timezone test harness. Use `_shared/tz.ts`.
- **Secrets never reach the browser.** ICS URLs, Google refresh tokens and the
  service role key live in Edge Function secrets only. The client gets the anon
  key, which is RLS-gated and safe to publish.
- **Never commit a real photo.** `dev-photos/` is gitignored and served only by a
  dev-only Vite plugin, so a local image can be used to judge the design without
  it reaching a build. Real photos belong in the Supabase Storage `photos`
  bucket behind a signed URL. A committed photo is in history forever.
- **`/tv` must survive a refresh.** [`vercel.json`](vercel.json) rewrites all
  paths to `index.html` (SPA). Don't remove it.
- **Keep scripts cross-platform.** `verify.mjs` resolves `npm.cmd` on win32.
- **RLS is the security boundary, not the UI.** The family allowlist is live
  (`0003_auth.sql`): reads require an authenticated session whose email is in
  `family_members`. Signing in is not the same as being allowed in — anyone can
  complete an OTP against the project and still see zero rows. Don't ship a
  write path without the matching policy.
- **Edge Functions bypass RLS** (service-role key), so ingest keeps running
  whether or not anyone is signed in. Never move ingest into the browser.

## Deploy

Push to `main` → Vercel auto-deploys. Migrations live in `supabase/migrations/`
and apply with `npm run db:push`. Runtime cron
([`supabase/schedule.sql.template`](supabase/schedule.sql.template)) is applied by
hand **after** Edge Functions are deployed and their secrets are set — it is
deliberately not in `migrations/`.

Full runbook for a fresh fork: [`SETUP.md`](SETUP.md).

## Display target

Built for a Samsung Frame (QLED, no burn-in), but any TV works — `/tv` is a fixed
1920×1080 stage that scales to fit. It is framed decor: gallery-grade type, large
and legible across a room. Iterate it in the preview panel.
