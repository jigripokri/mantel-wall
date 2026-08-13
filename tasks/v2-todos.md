# Task v2 — Google Tasks / Todos (OAuth + two-way sync + auth goes live)

**Prereq:** v1 shipped and deployed. Read [`MODULES.md`](../MODULES.md).
**Status:** not started.

## Goal of this slice

Google Tasks show on the wall and can be checked off from a phone, syncing both
directions. You learn OAuth to an external API — the trickiest integration
pattern, done once. **This is where Supabase Auth + the family allowlist go
live.**

## Build steps

1. **Google Cloud.** New project → OAuth consent screen → **Tasks API** scope
   (`tasks.readonly` to start, `tasks` for write-back). Do the OAuth flow **once**;
   store the **refresh token** in Supabase Vault / secrets — **never** in the
   browser.
2. **Ingest module** `src/modules/todos/` (+ `supabase/functions/sync-todos`):
   use the refresh token to pull task lists → upsert
   `{ type:'todo', source:'google_tasks', external_id: taskId, due_at, status,
   payload:{ title, list } }`. Handle token refresh + revocation. Add a cron line.
3. **Auth goes live.** Turn on Supabase Auth. Enforce the **family allowlist in
   RLS** (not just the UI): add the `entries_family_write` policy sketched in
   [`0002_rls.sql`](../supabase/migrations/0002_rls.sql). The TV keeps a
   persistent read-only display identity and must **never** see a login screen.
4. **Phone check-off.** `TodoTile` + a check action / `PhoneForm`: an authed
   family member marks a todo done → Edge Function writes back to Google Tasks →
   status syncs both ways. Checked items fade on the wall.

## Definition of done

- [ ] Google Tasks appear on `/tv`, grouped by person/list.
- [ ] A phone can check one off; it syncs back to Google and fades on the wall.
- [ ] Only allowlisted family sessions can write (verified against RLS, not UI).
- [ ] Refresh-token handling survives expiry/revocation.
- [ ] `npm run verify` green; both views reviewed in preview.

## Guardrails

- Refresh token is server-side only (Vault). If it ever appears in a client
  bundle or the repo, stop and rotate it.
- Don't ship the write path before the RLS write policy exists.
- Upsert on `(source, external_id)`; `external_id` = Google Task id.
