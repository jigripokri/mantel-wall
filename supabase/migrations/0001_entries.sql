-- The cornerstone table. Every feature lands here as a row and renders as a tile.
create table if not exists entries (
  id          uuid primary key default gen_random_uuid(),
  type        text not null,               -- 'event' | 'todo' | 'photo' | 'weather' | ...
  source      text,                        -- 'google_cal' | 'icloud' | 'school' | 'google_tasks' | 'upload'
  created_by  text,                        -- family member (for uploads/checks)
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  starts_at   timestamptz,                 -- events
  ends_at     timestamptz,
  due_at      timestamptz,                 -- todos
  expires_at  timestamptz,                 -- auto-hide stale
  status      text default 'active',       -- 'active' | 'done' | 'archived'
  color       text,                        -- per-person / per-source color
  external_id text,                        -- dedupe key for synced items (ICS UID, task id)
  pinned      boolean default false,
  sort_order  int default 0,
  payload     jsonb not null default '{}', -- type-specific (title, caption, assignee, location...)
  media_key   text                         -- Storage key for photos
);

-- Idempotent syncs: re-running an ingest upserts rather than duplicates.
create unique index if not exists entries_source_external_id_uidx
  on entries (source, external_id);
create index if not exists entries_type_status_idx on entries (type, status);
create index if not exists entries_starts_at_idx on entries (starts_at);

-- keep updated_at fresh
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists entries_set_updated_at on entries;
create trigger entries_set_updated_at
  before update on entries
  for each row execute function set_updated_at();
