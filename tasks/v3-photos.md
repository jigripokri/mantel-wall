# Task v3 — Photos (the contribution template)

**Prereq:** v2 shipped (auth is live). Read [`MODULES.md`](../MODULES.md).
**Status:** not started.

## Goal of this slice

A family member uploads a photo from their phone → it joins the wall rotation
within seconds (Realtime), oriented and fast. You build the upload/storage write
path — the reusable template every future contribution feature copies.

## Build steps

1. **Storage.** Create a `photos` bucket in Supabase Storage. RLS/storage policy:
   allowlisted family can upload; the display identity can read (signed URLs /
   display-sized derivatives only).
2. **`PhotosForm` (phone).** File input → **client-side process** before upload:
   HEIC→JPEG, resize ~1920px, fix EXIF orientation, compress. Upload to Storage →
   get `media_key`. Insert
   `{ type:'photo', source:'upload', media_key, payload:{ caption }, created_by }`.
3. **`PhotosTile` (wall, `layer:'background'`).** Full-bleed Ken-Burns rotation
   beneath the calendar/todo overlay tiles; caption overlay. This is the
   background layer the whole wall composes on top of.
4. **Rotation + realtime.** New upload appears in seconds via the existing
   `entries` Realtime subscription. "On this day" boost is a later nicety.

## Definition of done

- [ ] Upload from a phone → appears on `/tv` within seconds, correctly oriented.
- [ ] HEIC converts; large images are resized/compressed before upload.
- [ ] Photos serve via signed URLs / derivatives, not public originals.
- [ ] `npm run verify` green; wall reviewed at 75" proportions in preview.

## Guardrails

- Do the image processing **client-side before upload** — don't push 12MP HEICs
  through Storage.
- Only allowlisted sessions upload (Storage policy + RLS).
- `layer:'background'` — photos sit *under* the info overlay, never on top of it.
