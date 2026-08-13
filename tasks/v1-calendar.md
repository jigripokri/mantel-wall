# Task v1 — Calendar + weather (the ingest → render loop)

**Prereq reading:** [`MODULES.md`](../MODULES.md).
**Status: DONE (2026-07-19).** Real feed wired, functions deployed, cron active.
The wall runs unattended. Remaining v1-adjacent polish is listed at the bottom.

## Goal of this slice

The family's real schedule on the wall, color-coded, auto-refreshing. You learn
the ingest → render loop end to end. Done = real events from Google + iCloud +
school appear on the Frame and refresh unattended.

## What already exists

- Module: [`src/modules/calendar/`](../src/modules/calendar/) (`ingest`, `CalendarTile`, `ics.ts`).
- Module: [`src/modules/weather/`](../src/modules/weather/) (Open-Meteo, no key).
- Wall: [`src/tv/TvWall.tsx`](../src/tv/TvWall.tsx) — Today + Coming up + clock + weather.
- Edge twins: `supabase/functions/sync-calendar`, `sync-weather`.
- Cron template: [`supabase/schedule.sql.template`](../supabase/schedule.sql.template).

## Remaining work (in order)

1. **Real feeds.** Get the secret ICS URLs (Google Calendar per-calendar secret
   address, iCloud published calendar, school district ICS). Set `CALENDAR_FEEDS`
   as an Edge Function secret (JSON array of `{url, source, color}`). Assign a
   color per person/source.
2. **Deploy + schedule.** Deploy both functions; apply `schedule.sql.template`
   with the project ref + anon key filled in. Confirm rows land in `entries`.
3. ~~**Harden ICS (the hard part).**~~ **Done.** `ical.js@2.2.1` now backs a
   single canonical parser at `supabase/functions/_shared/ics.ts` (the twin is
   collapsed — see MODULES.md). It expands RRULE/RDATE, honours EXDATE and
   RECURRENCE-ID overrides, resolves VTIMEZONE, and falls back to an `Intl`
   conversion for Outlook-style or missing TZIDs. Window is now−7d → now+21d,
   reconciled read-diff-write. Two bugs in the old scaffold were fixed on the
   way: `allDay` was always false (a bad `slice`), and date-only values became
   UTC midnight, which rendered all-day events as 5pm the *previous* day.

   Covered by 52 tests that run **twice, under `TZ=UTC` and
   `TZ=America/Los_Angeles`** — the parser runs in Deno (UTC) and on the Pi, and
   ical.js ships no tzdata, so anything reading runtime-local time diverges
   between them with nothing else to catch it.
4. **Polish the wall.** Empty states, all-day events, multi-day events, the
   `dayPart` morning/evening emphasis switch. Verify at 75" proportions in the
   preview panel (it must look like a print, not a dashboard).

## Definition of done

- [x] Real events on `/tv` from the `family-mantel` Google calendar.
- [x] Recurring events show at the right times; timezones correct.
- [x] Sync is idempotent — confirmed against the live feed: a repeat run reports
      `unchanged` with zero writes, an upstream retitle came through as
      `updated: 1`, an upstream delete as `deleted: 1`.
- [x] Sync runs on cron (`*/15` calendar, `*/30` weather), verified through
      `pg_net` end to end.
- [x] `npm run verify` green; `/tv` reviewed in preview and looks gallery-grade.
- [x] Deployed to Vercel. (Pi loads it — pending the CanaKit.)

## Deferred out of v1

- **One colour for all events.** The household chose a single shared calendar,
  so per-person colour needs a `Alex: ` title-prefix convention plus a
  `PEOPLE` name→colour secret (~20 lines in the parser). Google's ICS export
  carries no per-event colour, so it's a convention or nothing.
- **School district feed.** A second entry in `CALENDAR_FEEDS` with its own
  `source` and colour whenever the URL turns up.

## Guardrails

- Upsert on `(source, external_id)`. For expanded recurrences `external_id` is
  `${UID}::${RECURRENCE-ID}`, not a bare UID — see MODULES.md § The idempotency
  rule. Never blind-insert.
- Secret ICS URLs live in Edge Function secrets, never in client code or the repo.
- The parser is shared, not twinned — change it once, in
  `supabase/functions/_shared/ics.ts`.
- **Never prune a source whose feed failed, or on an empty result.** Both would
  let a transient network blip delete a family member's calendar.
- Every feed needs a **unique `source`**; duplicates break the per-source prune.
- `CALENDAR_FEEDS` needs a companion `HOME_TZ` secret (default
  `America/Los_Angeles`) — it anchors all-day events and unresolvable TZIDs.
