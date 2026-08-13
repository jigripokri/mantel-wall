-- App settings — a small key/value table the wall reads and the phone writes.
--
-- This is the FIRST browser write path in the app. Everything before it is
-- read-only from the client; ingest writes with the service role, and
-- 0003_auth.sql shipped read policies only ("no browser writes in v1"). The
-- write policies below are the new security boundary, gated on the same
-- is_family() allowlist as reads.
--
-- Deliberately not a row in `entries`: a singleton config has no
-- starts_at/type semantics and would pollute the stream useEntries reads.

create table if not exists app_settings (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz default now(),
  updated_by  text
);

alter table app_settings enable row level security;

drop policy if exists app_settings_read_family on app_settings;
create policy app_settings_read_family
  on app_settings for select
  to authenticated
  using (is_family());

-- Writes: family only, insert and update split so WITH CHECK is explicit on
-- both. An authenticated user who is not on the allowlist is refused here just
-- as they see zero rows on read — signing in is not being allowed in.
drop policy if exists app_settings_insert_family on app_settings;
create policy app_settings_insert_family
  on app_settings for insert
  to authenticated
  with check (is_family());

drop policy if exists app_settings_update_family on app_settings;
create policy app_settings_update_family
  on app_settings for update
  to authenticated
  using (is_family())
  with check (is_family());

-- Reuse the updated_at trigger fn from 0001_entries.sql.
drop trigger if exists app_settings_set_updated_at on app_settings;
create trigger app_settings_set_updated_at
  before update on app_settings
  for each row execute function set_updated_at();

-- Default layout. The wall falls back to this for any unrecognised value too,
-- so a bad write can only ever show the default — never break the wall.
insert into app_settings (key, value) values ('tv_layout', '"side-veil"'::jsonb)
on conflict (key) do nothing;

-- Realtime so the wall repaints when the phone changes the setting. Guarded so
-- a re-run does not error on an already-published table.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'app_settings'
  ) then
    alter publication supabase_realtime add table app_settings;
  end if;
end $$;
