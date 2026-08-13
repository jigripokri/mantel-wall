-- Photo uploads — the family's second write path (after app_settings), and the
-- first that writes both Storage and `entries`.
--
-- 0004 created the private `photos` bucket with a family-only READ policy but no
-- write path, on purpose ("shipping a write path before the UI that needs it is
-- how buckets fill with things nobody meant to publish"). The UI ships now, so
-- the write paths open — each still gated on the same is_family() allowlist.

-- Storage: family may upload into the photos bucket. No delete policy — removing
-- a photo archives its `entries` row instead (reversible, and the object can be
-- swept later), so nothing here can hard-delete.
drop policy if exists photos_insert_family on storage.objects;
create policy photos_insert_family
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'photos' and is_family());

-- entries: family may insert and update PHOTO rows only. Scoping to type='photo'
-- keeps the calendar and weather rows browser-immutable — the only writable
-- entries are the ones the family actually contributes.
drop policy if exists entries_insert_photo_family on entries;
create policy entries_insert_photo_family
  on entries for insert
  to authenticated
  with check (is_family() and type = 'photo');

-- Update covers editing a caption and archiving (the soft delete). WITH CHECK
-- also pins type = 'photo' so a row can't be updated INTO or OUT of the writable
-- set.
drop policy if exists entries_update_photo_family on entries;
create policy entries_update_photo_family
  on entries for update
  to authenticated
  using (is_family() and type = 'photo')
  with check (is_family() and type = 'photo');
