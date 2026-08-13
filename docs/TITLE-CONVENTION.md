# MANTEL EVENT TITLE CONVENTION v2

The contract between whatever writes your calendar event titles (a person, a
script, a batch job) and the ingest that reads them. Conformance is enforced by
[`src/modules/calendar/ics.test.ts`](../src/modules/calendar/ics.test.ts) —
if this grammar changes, those tests change first.

Implemented by `splitPerson()` in
[`supabase/functions/_shared/ics.ts`](../supabase/functions/_shared/ics.ts).

## Grammar

```
title       = [ prefix ": " ] descriptor
prefix      = person | "Family"
person      = any `name` from src/config/family.ts
descriptor  = free text, Title Case, <= 35 chars
```

## Parsing

1. Split the title once on the **first** occurrence of `": "` (colon + space).
2. If a left-hand token exists **and** matches a known prefix (case-insensitive,
   from PREFIX KEYS), treat it as `prefix` and the remainder as `descriptor`.
   Use `prefix` for colour-coding and grouping.
3. Otherwise the whole string is the `descriptor` and prefix = `None`. Render
   with the neutral colour. Self-explanatory events deliberately carry no
   prefix — `Leo's 5th Birthday`, `FIFA World Cup Final`.
4. Never split on a colon that is not followed by a space, so `6:30` survives
   inside a descriptor.
5. Match on the prefix token only. Never infer a person from descriptor text:
   `Drop Alex at school` is unattributed.

## Prefix keys

The keys are your family's own — whatever `name` values you set in
[`src/config/family.ts`](../src/config/family.ts) — plus two fixed ones:

| Key | Colour role | Token |
| --- | --- | --- |
| *(each configured person)* | person-1..n | from `people[].color` |
| `Family` | shared | sage / green |
| *(none)* | neutral | warm grey |

The neutral colour is deliberately **not** one of the person colours. When it was
(the feed default was ochre, which was also the first person's colour), every
unprefixed event rendered as if it belonged to that person.

The live mapping ingest actually reads is the `PEOPLE` Edge Function secret —
name → colour. Generate it with `peopleMap()` from the config so the two can't
drift. Adding a person is a secret change and a re-sync, no deploy.

## Display

> **Changed in v2.** v1 said to show the full title as-is and truncate with an
> ellipsis. Both are now inverted; the reasons are below.

- **Strip the prefix on screen.** The wall renders `Swim`, never
  `Alex: Swim`. At 34px across a room, a repeated `Alex: ` prefix down the
  column is noise competing with the thing that actually varies.
- **Show the person once, dim, after the time** — `Swim  6:15 PM · Alex`.
  The coloured dot carries whose event it is pre-attentively; the name is the
  second signal. Per the person-palette note in `src/index.css`, colour is
  never the only signal — that is what keeps the wall readable for a
  colour-blind viewer, and it has to survive the prefix going away.
- **Wrap, don't truncate.** An ellipsis on a wall you read from six feet away
  destroys the one thing the row exists to convey. The grammar caps descriptors
  at 35 characters, which fits the column, so truncation would only ever fire on
  malformed input — where losing the text is the worst possible response.
  Overflow is capped by row count instead: at most three rows, with a faint
  `+ n more`.

## Forward compatibility

- An unknown prefix renders neutral and never errors. The title is left
  **completely intact** — `Dentist: follow-up appointment` must not silently
  become `follow-up appointment`, and a typo like `Kav:` must not quietly render
  as somebody else.
- Unrecognised prefixes are reported in the sync response (`unknownPrefixes`) so
  a typo surfaces in the logs rather than hiding as a permanently grey row.
- New people are added to `PEOPLE`; no code change.
- Bump this header if the grammar changes.
