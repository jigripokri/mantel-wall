-- Removing a photo actually removes it — the row and the object behind it.
--
-- 0007 shipped removal as a soft archive and deliberately withheld DELETE ("the
-- object can be swept later"). That never worked from the phone, and failed
-- silently, so the family's photos were effectively undeletable:
--
--   entries_read_family is `using (is_family() and status <> 'archived')`, and
--   PostgREST runs its UPDATE with a RETURNING clause. Postgres therefore
--   re-checks the NEW row against the SELECT policy — and the whole point of
--   archiving is to make the row fail that check. Every attempt came back
--   42501 "new row violates row-level security policy", and the client (which
--   never read the error) optimistically dropped the tile, so the photo
--   reappeared on the next load. Verified live against the project: updating a
--   caption on the same row returns 204, flipping status to 'archived' returns
--   403.
--
-- The alternative was to widen the read policy so archived rows stay visible to
-- their owners — i.e. make a row readable precisely when it is meant to be
-- hidden — and keep carrying storage for photos nobody can see. A family wall
-- has no use for a trash can: "remove this photo" means remove it. So removal
-- becomes a real delete, and the bucket stops accumulating orphans.
--
-- Scoped exactly like the insert/update policies: authenticated, on the family
-- allowlist, and photos only. Calendar and weather rows stay browser-immutable
-- — a delete there would be undone by the next ingest anyway, but the boundary
-- is what matters.

drop policy if exists entries_delete_photo_family on entries;
create policy entries_delete_photo_family
  on entries for delete
  to authenticated
  using (is_family() and type = 'photo');

-- Storage: the object is the photo. Deleting the row without this leaves a
-- private object nothing references and nobody can reach — invisible cost that
-- grows with every removal.
drop policy if exists photos_delete_family on storage.objects;
create policy photos_delete_family
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'photos' and is_family());
