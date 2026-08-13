# Task v0 — Personalize a fresh fork

**Prereq:** none. This is the first thing to do after cloning.
**Status:** run it once per fork.
**Slash command:** `/setup`

## Goal of this slice

Turn a freshly-cloned Mantel into *this* family's Mantel, without touching a
cloud account. When it's done, `npm run dev` shows a wall with the right names
and colours on it, still running entirely on mock data.

## Build steps

1. **Read the current config.** `src/config/family.ts`. If it still holds the
   shipped placeholders (`Alex`, `Sam`, `Robin`), this is a fresh fork. If not,
   don't start over — summarize what's there and ask what should change.

2. **Interview the user.** One round of questions, not a drip feed:
   - Who should be colour-coded on the wall? (→ `people[]`)
   - Is there a child with a weekly star chart? Name, and stars per week?
     (→ `starBank`; `enabled: false` if not)
   - Keep, replace, or drop the sign-in footer credit? (→ `credit`)

   **Don't** ask about timezone, weather location, or sign-in emails. Those are
   v0's siblings in `/provision` — they belong in Edge Function secrets and the
   `family_members` table, never in a file that compiles into the bundle.

3. **Assign colours.** Draw from the 5B person palette
   (`design/design_handoff_mantel_5b/tokens.css`) — matched lightness, so no one
   person shouts across the room. At least one person must differ from
   `neutralColor`.

4. **Write `src/config/family.ts`, and nothing else.** Every other file reads
   through it. If a change seems to require hardcoding a name elsewhere in
   `src/`, the config's *shape* is wrong — widen the config instead.

5. **Verify and look.** `npm run verify`, then preview `/tv` and `/`.

## Definition of done

- [ ] `src/config/family.ts` names this family; no placeholder names remain.
- [ ] No person's name appears as a literal anywhere else in `src/`.
- [ ] `npm run verify` green — including the two-timezone test run.
- [ ] `/tv` and `/` both previewed, and the new names are visibly on the wall.
- [ ] No email address was written to any tracked file.

## Guardrails

- **`src/config/family.ts` is public.** It compiles into the JS bundle that any
  visitor can read, signed in or not. Names and colours: fine. Emails, addresses,
  precise coordinates, anything about a child beyond a first name: not.
- **Tests address people through `FAMILY.people`**, never by literal — that's
  what lets the next fork rename everyone and stay green. Keep it that way.
- Mock mode must still work when you're done. It is how the next person evaluates
  this project.
