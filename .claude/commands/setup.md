---
description: Personalize a fresh Mantel fork — interview the user, rewrite src/config/family.ts, verify, and show the wall.
---

Personalize this fork of Mantel for the person running you. No cloud accounts are
needed — this stage is entirely local.

Follow [`tasks/v0-setup.md`](../../tasks/v0-setup.md), which is the full spec for
this slice. In short:

## 1. Check where they are

If `src/config/family.ts` still contains the shipped placeholder names (`Alex`,
`Sam`, `Robin`), this is a fresh fork — proceed. If it has already been
personalized, say so, summarize the current config, and ask what they want to
change instead of starting over.

## 2. Interview

Ask for everything in **one** `AskUserQuestion` round where you can — don't
interrogate them one field at a time. You need:

- **Who's on the wall.** Names of the people whose calendar events should be
  colour-coded. These become `people[]`. Their `name` doubles as the calendar
  title prefix (`Alex: Swim class`) and must later match a
  `family_members.display_name`.
- **The star bank.** Is there a child with a weekly reward chart? Their name, and
  how many stars make a week (default 10). If not, set `enabled: false`.
- **The credit footer.** Keep the upstream credit, replace it with their own, or
  remove it (`credit: null`). All three are fine — MIT doesn't require it.

Don't ask for their timezone, weather location, or emails here. Those are Stage 3
(`/provision`) and belong in Edge Function secrets and the database, not in this
file.

## 3. Assign colours

Pick from the 5B person palette in
`design/design_handoff_mantel_5b/tokens.css` — matched lightness so no one person
shouts across the room. Keep at least one person visually distinct from
`neutralColor`; a test enforces this, because the wall's whole point is "mine"
against "everyone else's".

## 4. Write it

Edit **only** `src/config/family.ts`. If you find yourself wanting to hardcode a
name anywhere else in `src/`, that's a bug in the config's shape — fix the shape.

## 5. Verify and show

Run `npm run verify`. It must be green. Then start the preview and look at both
routes — `/tv` and `/` — and confirm the new names actually render. Report what
you changed and what the wall looks like now.

Finally, point them at `SETUP.md` Stage 3 (or `/provision`) if they want to wire
it to a real backend.
