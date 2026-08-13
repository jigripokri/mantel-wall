# Contributing

Mantel is a small project with an opinionated shape. The fastest way to get a PR
merged is to read [`MODULES.md`](MODULES.md) first — it's the contract the whole
app is built on, and most review comments are just it being restated.

## Getting set up

```bash
npm install
npm run dev     # :5000 — /tv is the wall, / is the phone companion
```

No accounts, no database, no keys. You can build and review the entire UI against
mock data.

## Before you open a PR

```bash
npm run verify   # typecheck → lint → test → build
```

This must be green. Tests run twice, under `TZ=UTC` and
`TZ=America/Los_Angeles` — a suite that passes in one zone and fails in the other
is the bug this harness exists to catch.

Then look at the thing. `/tv` is decor hanging in someone's living room; a change
that typechecks but looks wrong on the wall isn't done. Screenshots in the PR are
appreciated.

## The rules that aren't negotiable

- **Mock mode must keep working.** `HAS_SUPABASE === false` has to render the
  full UI. It's how new people evaluate the project and how every UI change gets
  reviewed.
- **No names as literals.** People come from
  [`src/config/family.ts`](src/config/family.ts) — including in tests, which
  address them via `FAMILY.people` so a fork that renames its family stays green.
  No home locations or coordinates in tracked files either.
- **No real photos, ever.** `dev-photos/` is gitignored and served by a dev-only
  Vite plugin so you can iterate against a real image without it reaching a build
  or a commit. Anything committed is in history permanently.
- **RLS is the security boundary, not the UI.** A new write path ships with its
  policy, in a migration, in the same PR.
- **Secrets stay server-side.** ICS URLs and the service-role key live in Edge
  Function secrets. The browser gets the anon key.
- **No runtime-local time in `supabase/functions/_shared/`.** Ingest runs in Deno
  under UTC and the wall runs on a Pi. Use `_shared/tz.ts`.

## Adding a feature

Copy [`tasks/TEMPLATE.md`](tasks/TEMPLATE.md), fill it in, then build it. A slice
that doesn't fit on one page is two slices.

## Reporting bugs

Say which route (`/tv` or `/`), whether Supabase was configured, and what you
expected the wall to look like. Please **don't** paste real calendar data, family
photos, or an ICS URL into an issue — an ICS URL is a bearer token for your whole
calendar. Redact freely; mock data reproductions are ideal.
