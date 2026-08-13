-- Make a stalled pipeline visible.
--
-- Every failure mode this system has — cron unscheduled, feed URL revoked,
-- function throwing, Supabase down — looks identical on the wall: yesterday's
-- events, rendered confidently, forever. A family reads the wall and is wrong,
-- with nothing on screen to suggest doubt. That is worse than a blank panel.
--
-- The heartbeat cannot be derived from `entries.updated_at`, because the sync
-- is read-diff-write: a quiet week legitimately writes nothing, so "no recent
-- update" and "no recent sync" are indistinguishable there. This table is
-- written on every run whether or not anything changed.

create table if not exists sync_health (
  source          text primary key,
  last_success_at timestamptz,
  last_run_at     timestamptz,
  last_error      text,
  last_error_at   timestamptz,
  consecutive_failures int not null default 0
);

alter table sync_health enable row level security;

-- Same allowlist as everything else. Edge Functions write with the service
-- role, which bypasses RLS.
drop policy if exists sync_health_read_family on sync_health;
create policy sync_health_read_family
  on sync_health for select
  to authenticated
  using (is_family());

-- Seed a row per known ingest so a source that has NEVER run reads as stale
-- rather than as absent. A missing row is easy to render as "fine".
insert into sync_health (source) values ('family'), ('open_meteo')
on conflict (source) do nothing;
