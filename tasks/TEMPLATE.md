# Task vN — <slice name>

**Prereq:** <what must already ship, and which docs to read first>
**Status:** not started.

> Copy this file to `tasks/vN-<slice>.md` and fill it in *before* writing code.
> A slice that can't be written down this compactly is two slices.

## Goal of this slice

Two or three sentences, in terms of what a person sees or does — not in terms of
components. "A parent taps a star from the couch and the wall cheers" is a goal;
"add a StarBankController" is not.

## Build steps

Numbered, each one independently reviewable. Name the actual files. If a step
needs a schema change, it gets its own migration in `supabase/migrations/`, and
the migration number goes here.

1. **<Data>** — what lands in `entries` (or which new settings key), and how it
   upserts idempotently on `(source, external_id)`.
2. **<Wall>** — the tile, and which `layer` it composes on.
3. **<Phone>** — the write path, and the RLS policy that permits it.

## Definition of done

- [ ] The user-visible outcome from "Goal", confirmed in the preview.
- [ ] `npm run verify` green.
- [ ] Still works with **no Supabase configured** — mock mode is not optional.
- [ ] Both routes reviewed: `/tv` at wall proportions, `/` on a phone width.

## Guardrails

- Read [`MODULES.md`](../MODULES.md) first — the Feature Module contract is what
  keeps a new feature an afternoon rather than a refactor.
- No family member, child's name, home location, or email as a literal. Names
  come from [`src/config/family.ts`](../src/config/family.ts); emails live in the
  `family_members` table.
- No runtime-local time in anything `supabase/functions/_shared/` touches — use
  `_shared/tz.ts`. The two-timezone test run exists to catch exactly this.
- Secrets stay in Edge Function secrets. The browser gets the anon key and
  nothing else.
