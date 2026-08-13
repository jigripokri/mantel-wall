-- Photo storage for the wall's background layer.
--
-- The bucket is PRIVATE and stays private. Two separate things have to be true
-- for a family photo to reach a screen, and neither is the other's backstop:
--
--   1. The `entries` row carrying `media_key` is behind the allowlist policy
--      from 0003_auth.sql, so an anonymous reader never learns the key.
--   2. The object itself is behind the policy below, so even someone holding a
--      key cannot mint a signed URL without an allowlisted session.
--
-- Note what does NOT protect it: the Vercel deployment. Static files under
-- public/ are served to anyone, with no auth check, no matter what RLS says.
-- Family photos must never live in the repo — only here.

insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do update set public = false;

-- Only an allowlisted family session may read an object, which is what
-- createSignedUrl() does on their behalf.
drop policy if exists photos_read_family on storage.objects;
create policy photos_read_family
  on storage.objects for select
  to authenticated
  using (bucket_id = 'photos' and is_family());

-- Uploads are v3 (the phone contribution path). Until then the only writer is
-- the service role, which bypasses RLS. Deliberately no insert policy yet —
-- shipping a write path before the UI that needs it is how buckets fill with
-- things nobody meant to publish.
