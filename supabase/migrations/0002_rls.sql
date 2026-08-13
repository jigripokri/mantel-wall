-- RLS: the browser talks to the DB directly, so the wall's read access and the
-- family's write access are enforced here, not in the UI.
--
-- v1 posture (read-only display): anyone (the anon display identity) may READ
-- active/done entries; nobody writes from the browser. Ingest runs in Edge
-- Functions using the service-role key, which bypasses RLS.
--
-- v2 tightens this: writes become allowed only for an allowlisted family
-- session (see tasks/v2-todos.md), and reads may narrow. Ship v1 first.

alter table entries enable row level security;

-- Public read of non-archived rows (the Frame uses the anon key).
drop policy if exists entries_read_public on entries;
create policy entries_read_public
  on entries for select
  using (status <> 'archived');

-- No browser writes in v1. (Edge Functions use service_role and skip RLS.)
-- v2 will add: create policy entries_family_write ... using (auth.jwt() ->> 'email' = any(<allowlist>))

-- Realtime: let the wall subscribe to changes.
alter publication supabase_realtime add table entries;
