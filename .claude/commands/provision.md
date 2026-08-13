---
description: Wire this Mantel fork to a real Supabase + Vercel deployment, step by step.
---

Take this fork from mock data to a live wall. [`SETUP.md`](../../SETUP.md)
Stage 3 is the reference; this is the checklist to work through. **Every step is
idempotent** — if a session dies partway, re-run from the top and skip what's
already done.

## Before you start

Confirm two things and stop if either is false:

1. `src/config/family.ts` has been personalized (run `/setup` first if not).
2. `npm run verify` is green.

Then tell the user what this will do, and that they'll need free Supabase and
Vercel accounts.

## Things you cannot do — hand these to the user

Do not try to work around these. Stop, explain exactly what you need, and wait.

- **`npx supabase login` and `vercel login`** open a browser for an interactive
  OAuth flow. The user runs these.
- **The ICS feed URL** comes from Google Calendar → Settings → *Secret address in
  iCal format*. Only they can fetch it.
- **The database password** at project-create time — generate one, show it once,
  and tell them to store it in a password manager. It goes in no file.

## Supabase

1. `npx supabase orgs list` → pick an org id.
2. `npx supabase projects create <name> --org-id <org> --region <region> --db-password <generated>`
3. `npx supabase link --project-ref <ref>`
4. `npm run db:push` — applies everything in `supabase/migrations/`.
5. `npx supabase projects api-keys --project-ref <ref>` → the **anon** key.
6. Write `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` into `.env.local`
   (gitignored — never commit it, never echo the values into a doc).
7. Add each family member, matching `display_name` to a `name` in
   `src/config/family.ts`:
   ```
   npx supabase db query --linked \
     "insert into family_members (email, display_name) values ('them@example.com','Alex')"
   ```
   Give the TV its own row with `is_device = true` so a human signing out on
   their phone can't darken the wall.
8. Set `site_url` and `additional_redirect_urls` in `supabase/config.toml` to the
   deployed origin once Vercel gives you one. **Read the warning at the top of
   that file first** — `config push` pushes the whole `[auth]` block, not a diff.

## Ingest

9. `npx supabase functions deploy sync-calendar sync-weather`
10. `npx supabase secrets set CALENDAR_FEEDS='[...]' PEOPLE='{...}' HOME_TZ=... WEATHER_LAT=... WEATHER_LON=...`
    - Generate `PEOPLE` from `peopleMap()` in `src/config/family.ts` so the two
      can't drift.
    - Each feed's `source` must be unique — `sync-calendar` refuses to run
      otherwise.
    - Round the coordinates to two decimals. That's ~1km: fine for a forecast,
      and not their street.
    - **The ICS URL is a bearer token.** Edge Function secrets only. Never a
      `VITE_` variable, never a committed file.
11. Invoke `sync-calendar` once by hand and read the JSON response: per-feed
    `parsed` / `inserted` / `updated` / `deleted`. A `207` means partial success —
    investigate before moving on.
12. Only once ingest works: fill in `supabase/schedule.sql.template` and run it to
    enable cron. This is deliberately not a migration.

## Vercel

13. `vercel link` → creates the project.
14. `vercel env add VITE_SUPABASE_URL production` (and `preview`), same for the
    anon key.
15. `vercel git connect` → push-to-main auto-deploy.
16. `vercel deploy --prod` → record the URL, then go back and do step 8.

## Definition of done

- Deployed `/tv` shows the **live** dot, not demo.
- Inserting a test row in `entries` makes it appear on the deployed `/tv` within
  about a second, with no refresh. Delete the test row afterwards.
- A signed-in family member sees rows; a signed-in stranger sees zero. Verify
  this rather than assuming it — RLS is the security boundary.

## When you're done

Summarize what was created, what secrets were set (**by name only — never print
their values**), and what's left for the user: the Pi kiosk (Stage 4) and adding
any remaining family members.
