# Setting up your own Mantel

Four stages, and you can stop after any of them. Stage 1 needs no accounts at
all; the wall is fully explorable before you decide whether it's worth wiring up.

If you use [Claude Code](https://claude.com/claude-code), stages 2 and 3 are
packaged as slash commands — `/setup` and `/provision` — that do the editing and
the CLI work for you. Everything below is also just a runbook you can follow by
hand.

---

## Stage 1 — See it, with nothing installed but Node

```bash
git clone https://github.com/<you>/mantel.git
cd mantel
npm install
npm run dev
```

- <http://localhost:5000/tv> — the wall
- <http://localhost:5000/> — the phone companion

There is no database and no account. `HAS_SUPABASE` is false, so the app serves
deterministic mock data from [`src/lib/mockData.ts`](src/lib/mockData.ts). Every
screen renders, the layout switcher works, the star bank taps. This mode is
load-bearing, not a demo toy — keep it working if you contribute.

## Stage 2 — Make it your family's

Everything that names a person lives in one file:
[`src/config/family.ts`](src/config/family.ts). Open it and set:

| Field | What it is |
| --- | --- |
| `people[]` | Everyone the wall knows: `id` (stable, stored in the star log), `name` (must match a `family_members.display_name`, and is the calendar title prefix), `color` |
| `neutralColor` | The tint for unattributed stars |
| `starBank` | `enabled`, `childName`, `goal` — or `enabled: false` to remove it |
| `credit` | The sign-in footer. `null` removes it |

> **With Claude Code:** run `/setup`. It interviews you, rewrites the file, runs
> `npm run verify`, and shows you the wall.

Then `npm run dev` and look at `/tv`. Still no accounts.

**Keep secrets out of this file.** It compiles into the public JS bundle. Sign-in
emails deliberately live in the `family_members` database table instead — see
Stage 3.

## Stage 3 — Wire the backend

Now you need two free accounts: [Supabase](https://supabase.com) (database,
auth, storage, realtime) and [Vercel](https://vercel.com) (hosting). There is no
server to write or run.

> **With Claude Code:** run `/provision`. It drives every step below, stopping to
> hand you the browser for the two interactive logins.

### 3a. Supabase

```bash
npx supabase login                                  # opens a browser — you do this one
npx supabase link --project-ref <your-project-ref>
npm run db:push                                     # applies supabase/migrations/
```

Copy the **Project URL** and **anon key** from Project Settings → API into
`.env.local` (copy `.env.example` first). Restart `npm run dev` — `/tv`'s status
dot should flip from **demo** to **live**.

### 3b. Let your family in

Signing in is not the same as being allowed in. Anyone can complete an email OTP
against your project; `family_members` is what grants access, and RLS enforces
it. An unlisted signed-in user sees exactly zero rows.

```bash
npx supabase db query --linked \
  "insert into family_members (email, display_name) values ('you@example.com','Alex')"
```

`display_name` **must match** a `name` in `src/config/family.ts` — that match is
how a sign-in becomes a person and gets their star colour.

Give the TV its own row with `is_device = true`, so a human signing out on their
phone can never darken the wall.

### 3c. Ingest (calendar + weather)

```bash
npx supabase functions deploy sync-calendar sync-weather
npx supabase secrets set \
  CALENDAR_FEEDS='[{"url":"<your-secret-ics-url>","source":"google_cal","color":"hsl(42 60% 62%)"}]' \
  PEOPLE='{"Alex":"hsl(208 66% 72%)","Sam":"hsl(44 74% 56%)"}' \
  HOME_TZ=America/Los_Angeles WEATHER_LAT=37.77 WEATHER_LON=-122.42
```

- The ICS URL comes from Google Calendar → Settings → *Secret address in iCal
  format*. **It is a bearer token** — it belongs in Edge Function secrets and
  nowhere else. Never in `.env.local` under a `VITE_` name.
- Each feed's `source` must be unique; `sync-calendar` refuses to run otherwise,
  because the reconcile treats `source` as a calendar's identity.
- `PEOPLE` should match `peopleMap()` from your config.
- Round your weather coordinates. Two decimals is about a kilometre — plenty for
  a forecast, and not your street.

Trigger the function once by hand and read the JSON: it reports per-feed
`parsed` / `inserted` / `updated` / `deleted`. A `207` means some feeds landed
and some didn't.

Then turn on cron by filling in
[`supabase/schedule.sql.template`](supabase/schedule.sql.template) and running it
against your database. This is deliberately **not** a migration — it must not run
until the functions are deployed and their secrets are set.

### 3d. Vercel

1. Import your fork at <https://vercel.com/new>. Framework preset: **Vite**.
2. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
3. Deploy. Every push to `main` auto-deploys after this.
4. Put your deployed origin into
   [`supabase/config.toml`](supabase/config.toml) (`site_url` +
   `additional_redirect_urls`) or magic links will dead-end on `localhost:3000`.

> **Read the warning at the top of `config.toml` before running
> `supabase config push`.** It pushes the whole `[auth]` block, not a diff —
> anything not declared there silently reverts to the CLI's defaults.

### Sanity check

- `/tv` on the deployed URL shows **live**, not demo.
- Insert a row in the Supabase table editor → it appears on `/tv` in about a
  second, no refresh. That's Realtime working.

## Stage 4 — Hang it on a wall

Point a Raspberry Pi's Chromium at `https://<your-project>.vercel.app/tv` in
kiosk mode. The display this was built for is a Samsung Frame, but any TV works —
`/tv` is a fixed 1920×1080 stage that scales to fit.

Two things worth knowing:

- `/tv` must survive a refresh. [`vercel.json`](vercel.json) rewrites all paths
  to `index.html`. Don't remove it.
- The wall signs in once and stays signed in for months. `jwt_expiry` is set to a
  week in `config.toml` for exactly this reason.

## A note on what's public

Your fork is your deployment. Before you make **your** fork public, check that
you haven't committed:

- family photos (`dev-photos/` is gitignored for this reason — real photos belong
  in the Supabase Storage bucket, behind a signed URL)
- your ICS feed URL, anywhere
- your Supabase project ref or deployed origin, if you'd rather not link them to
  your name
- sign-in emails — which is why they live in the database, not `family.ts`

The anon key is safe to expose: it is RLS-gated and does nothing on its own. The
service-role key is not, and never leaves Edge Function secrets.
