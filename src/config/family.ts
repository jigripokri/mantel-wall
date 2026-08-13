/**
 * The one file to edit when you fork Mantel.
 *
 * Everything here is *identity* — who lives on this wall and what it calls
 * them. Nothing here is a secret: it is compiled into the browser bundle, so
 * treat it as public even on a private deployment. Sign-in emails deliberately
 * do NOT live here (see `identity` below).
 *
 * Run `/setup` in Claude Code and it will interview you and rewrite this file.
 */

/** A person the wall knows about. */
export type Person = {
  /** Stable key, stored in the star log. Rename `name` freely; changing `id`
   *  orphans stars already given, which then fall back to the neutral colour. */
  id: string;
  /** Display name. MUST match the `display_name` on this person's
   *  `family_members` row — that match is how a sign-in becomes a person. It is
   *  also the calendar title prefix ("Alex: Swim class"). Case-insensitive. */
  name: string;
  /** The colour their stars are tinted. Keep lightness matched across people so
   *  no one shouts on the wall; see design/design_handoff_mantel_5b/tokens.css. */
  color: string;
};

export type FamilyConfig = {
  people: Person[];
  /** Stars from an unrecognised signer, from mock mode, and from before the
   *  giver was recorded. Reusing one person's colour here is fine — the only
   *  distinction the wall needs is "mine" against "everything else". */
  neutralColor: string;
  starBank: {
    /** false hides the star bank everywhere — the wall falls back to layouts
     *  that don't reserve space for it. */
    enabled: boolean;
    /** Whose week it is. Shown on the wall and as "<name>'s week" on phones. */
    childName: string;
    /** Stars per week. Ten is the shipped default; the research this was built
     *  from favours a row short enough to finish. */
    goal: number;
  };
  /** Footer credit on the sign-in screen. Yours to change — the MIT licence
   *  does not require you to keep it. */
  credit: { label: string; url: string } | null;
};

/**
 * ---------------------------------------------------------------------------
 * EDIT BELOW. The values shipped here are placeholders for a family of two
 * parents and one child; they are what the mock-data preview renders.
 * ---------------------------------------------------------------------------
 */
export const FAMILY: FamilyConfig = {
  people: [
    { id: "person-1", name: "Alex", color: "hsl(208 66% 72%)" }, // pastel blue
    { id: "person-2", name: "Sam", color: "hsl(44 74% 56%)" }, // gold
  ],

  neutralColor: "hsl(44 74% 56%)",

  starBank: {
    enabled: true,
    childName: "Robin",
    goal: 10,
  },

  credit: { label: "StickyWicketLabs", url: "https://stickywicketlabs.com/" },
};

/**
 * How a signed-in email becomes one of `people`.
 *
 * Deliberately NOT a map in this file. Emails here would ship in the public JS
 * bundle, readable by anyone who loads the page signed out. Instead the link is
 * made at runtime through the `family_members` table, which is behind RLS:
 *
 *   insert into family_members (email, display_name) values ('you@example.com', 'Alex');
 *
 * `useFamily()` reads that roster and matches `display_name` to `Person.name`.
 * No match — or no Supabase at all — leaves stars the neutral colour.
 */

/** Look up a person by id. Unknown ids (a renamed person, a legacy star, a
 *  fork that dropped someone) resolve to null rather than throwing. */
export const personById = (id: string | null | undefined): Person | null =>
  FAMILY.people.find((p) => p.id === id) ?? null;

/** Look up a person by display name, case-insensitively — the `family_members`
 *  join, and the calendar title-prefix match. */
export const personByName = (name: string | null | undefined): Person | null => {
  if (!name) return null;
  const needle = name.trim().toLowerCase();
  return FAMILY.people.find((p) => p.name.toLowerCase() === needle) ?? null;
};

/** Name → colour, the shape `splitPerson()` and the PEOPLE ingest secret use.
 *  Handy for keeping the Edge Function secret in step with this file. */
export const peopleMap = (): Record<string, string> =>
  Object.fromEntries(FAMILY.people.map((p) => [p.name, p.color]));

/** One colour that reads as "not the neutral one", for the celebration burst
 *  and the phone's shard shower — they mix two tints so the confetti doesn't
 *  read as a single flat sheet. Falls back to neutral in a one-person family. */
export const accentColor = (): string =>
  FAMILY.people.find((p) => p.color !== FAMILY.neutralColor)?.color ?? FAMILY.neutralColor;
