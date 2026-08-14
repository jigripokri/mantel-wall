# Demo photo prompts

The wall is a photograph with a dark veil over its left third. That constrains
what a good photo looks like far more than taste does — a beautiful image with
its subject on the left becomes an invisible image once the veil lands on it.

These prompts are engineered against the real geometry. Paste them into Gemini
(Nano Banana), Imagen, or whatever you use, and drop the results into
`dev-photos/` — which is gitignored, so nothing you generate reaches a commit.

> **These are synthetic people.** Generate a family that does not exist. Never
> prompt for a real, named, or identifiable person, and never put an actual
> family photo in this repository — see the note at the bottom.

The prompts describe different households on purpose. This is a template other
families fork; a set that only ever pictures one kind of family is a poor
default. Rewrite the people in any of them — the composition rules below are the
part that has to survive.

---

## The constraint, in one picture

The veil is `linear-gradient(100deg, …0.94 → 0.78 at 34% → 0 at 62%)` over a
1920×1080 stage:

```
x=0        x=653 (34%)          x=1190 (62%)              x=1920
├─────────────┼──────────────────────┼─────────────────────────┤
│  VEIL ≥0.78 │   transition ramp    │   photo fully visible   │
│  type lives │   nothing important  │   PUT THE SUBJECT HERE  │
│  here       │   reads here         │                         │
```

So every prompt below asks for:

- **16:9, 1920×1080.**
- **Subject in the right 40%** — faces centred around x ≈ 1350–1650.
- **A calm, darker left third.** Sky, foliage, a wall, shade. Not clutter, and
  not a bright highlight — even at 0.78 alpha a blown-out patch drags the type's
  contrast down.
- **Warm natural light.** The whole design sits in an amber/ochre range
  (`hsl(26–42, …)`); a cold blue-grey photo fights the type.
- **Room at the edges.** Ken Burns zooms 1.00 → 1.08, so keep faces at least 5%
  in from every edge or they'll drift out of frame mid-pan.

---

## 1. Golden hour, back garden — the hero

> Candid documentary photograph of a young family in a back garden at golden
> hour, late summer. A parent lifts a laughing four-year-old overhead; an older
> child watches from beside them. **The group is positioned in the right third of
> the frame**, faces around 70–80% of the way across. The left third is open,
> softly shaded lawn and out-of-focus hedge — quiet, uncluttered, no bright
> highlights. Warm low sun from behind the subjects, gentle rim light on hair,
> soft amber haze. Shot on 85mm at f/2, shallow depth of field, natural skin
> tones, subtle film grain. Muted warm palette — ambers, olive greens, dusty
> terracotta. No text, no logos, no watermark. 16:9, cinematic, 1920×1080.

## 2. Kitchen morning — the everyday one

> Warm candid photograph of a family making breakfast in a sunlit kitchen. Two
> children at a wooden counter, one reaching for a bowl, a parent half out of
> frame pouring. **Subjects grouped in the right 40% of the frame.** The left
> third is a plain warm-white wall in soft shade with a hanging plant — calm
> negative space, no bright window. Morning light rakes in from the right,
> catching flour dust in the air. 35mm, f/2.8, documentary style, unposed, slight
> motion blur on a moving hand. Warm neutral palette, creamy highlights, no harsh
> whites. No text or logos. 16:9, 1920×1080.

## 3. Beach at dusk — the wide one

> Photograph of two children running along a wet beach at dusk, seen from behind,
> silhouetted against a low amber sun. **The children are in the right third**,
> small in the frame; the left two-thirds is open damp sand and gentle surf
> reflecting a dark violet sky. Deep shadows on the left, warm glow concentrated
> on the right horizon. Long lens compression, 135mm, f/4. Rich but subdued
> colour — indigo, plum, burnt orange. Grainy, filmic, nostalgic. No text or
> logos. 16:9, 1920×1080.

## 4. Living room, evening — the intimate one

> Intimate available-light photograph of a parent reading to a small child on a
> sofa in the evening, lit only by a nearby warm lamp. **The pair sit in the
> right 40% of the frame**, turned slightly toward each other. The left of the
> frame falls into deep, soft shadow — a dark wall, a sliver of doorway, almost
> black. High contrast, warm tungsten glow, deep amber shadows. 50mm, f/1.8,
> visible grain, no flash. Cosy, quiet, unposed. No text or logos. 16:9,
> 1920×1080.

## 5. Autumn walk — the seasonal one

> Candid photograph of a family walking a leaf-covered path in autumn woodland,
> late afternoon. **They are grouped in the right third**, walking away from
> camera, a child holding a parent's hand and looking back. The left of the frame
> is receding path and dark tree trunks in shade — deep, calm, low detail. Warm
> backlight through amber and rust foliage, sun flare low on the right. 70mm,
> f/2.8, shallow depth. Palette of ochre, rust, moss, deep brown. Filmic, soft
> contrast. No text or logos. 16:9, 1920×1080.

## 6. Golden hour, garden — a North Indian family

Same composition as #1, different household. Swap in whoever's wall this is —
the geometry is what matters, not the family. The marigold-and-terracotta
palette here sits closer to the app's own tokens than #1 does.

> Candid documentary photograph of a young North Indian family in a garden at
> golden hour, late summer. A mother in a soft cotton kurta lifts a laughing
> three-year-old overhead; an older brother in a t-shirt and shorts watches from
> beside them, grinning. **The group is positioned in the right third of the
> frame**, faces about 75% of the way across. The left third is open, softly
> shaded lawn with a bougainvillea hedge falling into shadow — quiet,
> uncluttered, no bright highlights. Warm low sun from behind the subjects,
> gentle rim light on dark hair, soft amber haze, dust in the air. Marigold beds
> and terracotta pots along the right edge, a low plastered boundary wall, a neem
> tree behind. Warm brown skin tones rendered naturally and accurately. Shot on
> 85mm at f/2, shallow depth of field, subtle film grain. Muted warm palette:
> ambers, marigold orange, terracotta, deep green. No text, no logos, no
> watermark. 16:9, 1920×1080.

For a rooftop terrace instead — common in North Indian homes, and a good look
— replace the setting clause with: *"on an open rooftop terrace at golden hour,
potted plants and a low parapet wall along the right, city rooftops soft and
hazy behind, laundry line out of focus on the left in shadow."*

If a result drifts festive, add *"ordinary weekday clothing, not festive or
wedding attire"* — the prompt asks for everyday cotton on purpose.

---

## Checking one before you commit to it

Drop the file in `dev-photos/`, then:

```bash
VITE_DEV_PHOTO_URL=/dev-photos/your-photo.jpg npm run dev
```

Open `/tv` and ask three questions:

1. **Can you read the column from across the room?** If the type is fighting the
   photo, the left third is too bright or too busy.
2. **Is the subject still there?** Watch a full Ken Burns cycle — if a face
   drifts out of frame on the zoom, it was too close to an edge.
3. **Does it look like decor?** If it reads as a wallpaper or a stock photo
   rather than something you'd hang, keep generating.

To regenerate every screenshot in the README against your new photo:

```bash
node scripts/shots.mjs
```

## Never commit a real photo

`dev-photos/` is gitignored and served only by a dev-only Vite plugin, so a local
image can never reach a build. Real family photos belong in the Supabase Storage
`photos` bucket, behind a signed URL. Anything committed is in git history
permanently — that is not recoverable by deleting it later.

The family in `docs/screenshots/` and `docs/social/` was generated from prompt 1
below. Those people do not exist, which is exactly why those images are safe to
commit and a real photo of your own would not be. The source files stay in
gitignored `dev-photos/`; only the rendered screenshots are tracked.
