-- Auth: close the wall.
--
-- v1 shipped `entries_read_public` — select allowed to anyone, no auth check.
-- That was written before there was real data behind it. With the family
-- calendar live, the deployed URL served real events to anyone who typed it.
-- This migration replaces open read with an allowlist.
--
-- Signing in is NOT the same as being allowed in: anyone can complete an email
-- OTP against this project. Membership in `family_members` is what grants
-- access, so an unknown signed-in user sees exactly zero rows.
--
-- Edge Functions are unaffected — they use the service-role key, which bypasses
-- RLS entirely, so ingest keeps running whether or not anyone is signed in.

create table if not exists family_members (
  email        text primary key,
  display_name text,
  -- The Pi kiosk gets its own identity rather than borrowing a person's, so a
  -- human signing out on their phone can never darken the wall.
  is_device    boolean default false,
  added_at     timestamptz default now()
);

alter table family_members enable row level security;

-- SECURITY DEFINER so the check itself can read the roster without recursing
-- through this very policy. search_path is pinned: a definer function that
-- resolves names through a caller-controlled search_path is a privilege
-- escalation waiting to happen.
create or replace function is_family()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from family_members
    where lower(email) = lower(nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'email', ''))
  );
$$;

revoke all on function is_family() from public;
grant execute on function is_family() to authenticated;

-- Members may read the roster (so the phone can show who's on it). Nobody
-- writes it from the browser — adding a family member is a deliberate act
-- performed with the service role.
drop policy if exists family_members_read on family_members;
create policy family_members_read
  on family_members for select
  to authenticated
  using (is_family());

-- The change that actually closes the wall.
drop policy if exists entries_read_public on entries;

drop policy if exists entries_read_family on entries;
create policy entries_read_family
  on entries for select
  to authenticated
  using (is_family() and status <> 'archived');

-- Still no browser writes. The contribution path (todos, photo uploads) lands
-- with v3 and will add an insert policy gated on the same is_family() check.
