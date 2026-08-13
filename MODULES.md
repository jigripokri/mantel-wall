# MODULES.md — the Feature Module contract

**Hand this file to every session that adds or changes a feature.** It is the one
abstraction the whole app is built on. Read it, then read `tasks/<version>-*.md`
for the slice you're building.

## The cornerstone

Every feature is the same shape:

> data lands in one `entries` table → renders as a tile on the wall → (later)
> family input is one auth'd write.

There is **no bespoke backend**. Supabase RLS lets the browser read the DB
directly; Supabase Realtime pushes changes to the wall with no polling; scheduled
ingest runs in Edge Functions. Adding a feature never means "write a server."

## Two flavors, one shape

```ts
type FeatureModule = {
  type: string;                 // matches entries.type
  label: string;
  Icon?: FC;
  PhoneForm?: FC<{ onDone }>;   // CONTRIBUTION flavor (photos): family adds via phone
  ingest?: (ctx) => Promise<EntryUpsert[]>;  // INGEST flavor (calendar/weather/tasks)
  TvTile: FC<{ entry }>;        // render on the wall
  showOnTv?: (e, now) => boolean;
  rotationWeight?: number;
  layer?: 'background' | 'overlay';   // photos = background; info = overlay
};
```

- **Ingest modules** (calendar, weather, todos): a scheduled Edge Function calls
  `ingest()`, which is a **pure** function — it takes an `IngestContext`
  (`{ now, env, fetch }`) and returns rows to upsert. No DB handle inside it, so
  it runs identically in a unit test and in the Edge Function.
- **Contribution modules** (photos): `PhoneForm` runs on the phone route and does
  an auth'd write (upload + insert).

The full type lives in [`src/lib/types.ts`](src/lib/types.ts) — that file is the
source of truth; this doc explains it.

## Adding a feature — the checklist

1. `src/modules/<name>/index.tsx` — export a `FeatureModule`.
2. Register it in [`src/modules/index.ts`](src/modules/index.ts) (`MODULES` array).
3. If it **ingests**: put the pure logic in `supabase/functions/_shared/` (see
   § The ingest twin) and create the deployable function at
   `supabase/functions/sync-<name>/index.ts` importing the shared upsert helper.
   Add a cron line to
   [`supabase/schedule.sql.template`](supabase/schedule.sql.template).
4. If it **contributes**: implement `PhoneForm`; it writes through an
   authenticated Supabase session (RLS enforces the family allowlist).
5. `npm run verify` must pass (typecheck → lint → **test** → build). Preview
   `/tv` and `/` before committing.

## The idempotency rule (do not skip)

Synced rows **always** upsert on `(source, external_id)` — never blind-insert.
The unique index in [`0001_entries.sql`](supabase/migrations/0001_entries.sql)
enforces it; re-running a sync updates rather than duplicates.

`external_id` is the ICS `UID`, the Google Task id, etc. — **except for expanded
recurrences**, where it is `${UID}::${RECURRENCE-ID}`. A weekly event's
occurrences all share one UID, so a bare UID would collapse them into a single
row (last write wins, silently). The key is the RECURRENCE-ID rather than the
occurrence's start time because dragging one instance changes the start but not
the recurrence id — keying on start would orphan a row on every such edit.

`external_id` must never be NULL: the unique index treats NULLs as distinct, so a
null key silently disables idempotency and duplicates without bound.

## Reconciling a window (ingest that can delete)

An ingest that expands a rolling window must also remove what vanished upstream.
[`syncWindow`](supabase/functions/_shared/upsert.ts) does this as
**read-diff-write**: it reads the window, writes only genuinely-changed rows, and
deletes only rows that disappeared.

It is deliberately not a blind re-upsert. Postgres `ON CONFLICT DO UPDATE` always
writes a new tuple even when every column is identical, so re-upserting a few
hundred occurrences every 15 minutes would emit that many Realtime UPDATEs to
change nothing — enough to risk throttling the wall into silent staleness.

Two guards are **not optional**, because both fail destructively:

- **Never prune a source whose feed failed to fetch.** An unreachable feed means
  "we don't know", not "it's empty". Without this, one transient 503 blanks that
  calendar off the wall.
- **Never prune on an empty result.** A calendar going from N events to zero in
  one run is far more likely a broken feed than a genuinely emptied calendar. A
  stale row is recoverable; a deleted one is not.

## The ingest twin (collapsed)

The parser is **no longer duplicated**. It lives once at
[`supabase/functions/_shared/ics.ts`](supabase/functions/_shared/ics.ts): the
Edge Function imports it directly, and `src/modules/calendar/ics.ts` re-exports
it for the browser and the tests. `supabase/functions/deno.json` maps the bare
`ical.js` specifier to `npm:` for Deno; Vite resolves it from `node_modules`.

The canonical direction matters — shared code lives *under* the functions root so
the Supabase CLI never has to bundle imports from outside it. Files there are
named explicitly in `tsconfig.app.json` and un-ignored in `eslint.config.js`, or
they would silently escape both gates.

**The import map must sit in the importing function's own directory.** A shared
`supabase/functions/deno.json` is silently ignored and the deploy fails with
`Relative import path "ical.js" not prefixed with / or ./ or ../`. Every function
that imports shared code with a bare specifier needs its own `deno.json` copy.
This only shows up at `functions deploy` — nothing local catches it.

**Anything shared across this boundary must be timezone-explicit.** The two
runtimes have different local zones (Deno is UTC; the Pi is not), so any value
derived from runtime-local time diverges between them with nothing to catch it.
`vitest.config.ts` runs every suite twice under two host zones for exactly this
reason — see the note there before adding a date path.

## Retheming

The look is almost entirely design tokens in
[`src/index.css`](src/index.css) (`@theme`) — colors as HSL, `--font-sans` /
`--font-display`. The wall is framed decor at 75"; keep type large and calm. On a
Frame, ugly reads as broken.

## Layers on the wall

- `layer: 'background'` — photos (v3), full-bleed Ken-Burns beneath everything.
- `layer: 'overlay'` — calendar / weather / todos info tiles on top.
- `dayPart` (`src/lib/time.ts`) switches emphasis: morning = agenda + weather,
  evening = tomorrow + photos.

## Build order (the skill ladder)

1. **v1 Calendar + weather** — ingest → render loop. `tasks/v1-calendar.md`.
2. **v2 Google Tasks** — OAuth + two-way sync + auth goes live. `tasks/v2-todos.md`.
3. **v3 Photos** — the upload/storage contribution template. `tasks/v3-photos.md`.
