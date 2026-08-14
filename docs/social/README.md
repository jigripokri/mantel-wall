# Social assets

Share images for Mantel, generated from the app's own screenshots so they can
never drift from what the product actually looks like.

| File | Pixels | Layout size | Where it goes |
| --- | --- | --- | --- |
| `linkedin-hero.jpg` | 2400×1254 | 1200×627 | LinkedIn / X link preview, blog headers |
| `og-card.jpg` | 2560×1280 | 1280×640 | GitHub **Settings → Social preview**, `og:image` |
| `carousel-1…5.jpg` | 2160×2160 | 1080×1080 | LinkedIn carousel or image post, Instagram |

Rendered at **2×**: the frames are laid out at the platform-native sizes and
captured at twice the pixel density, which is what survives LinkedIn's
re-encode. Upload them as-is — every platform downscales, none upscale.

## Regenerating

```bash
npm i -D playwright && npx playwright install chromium   # once; not a project dependency
node scripts/shots.mjs      # app screenshots  → docs/screenshots/
node scripts/social.mjs     # share images     → docs/social/
```

`templates.html` is the source. Every frame is a `.frame` element sized in CSS
and captured by id, so changing a headline means editing HTML, not a design
tool. Open it directly in a browser to iterate.

The screenshots are embedded by relative path, so a new wall photo flows all the
way through: generate a photo, re-run `shots.mjs`, re-run `social.mjs`, and the
carousel updates itself.

## The photo behind the wall

The family in these assets is **AI-generated and does not exist**. No real
family photo is ever committed to this repository, and the source images live in
gitignored `dev-photos/` rather than in git.

To swap in your own, see [`docs/PHOTO-PROMPTS.md`](../PHOTO-PROMPTS.md): prompts
engineered against the veil geometry, since the wall's scrim covers the left
third and a photo with its subject on the left is an invisible photo.

## Typography

Newsreader for display, Instrument Sans for text — the same pairing the wall
uses, loaded from Google Fonts. `document.fonts.ready` is awaited before capture;
screenshotting before the webfonts land reflows every headline.
