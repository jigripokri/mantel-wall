# Handoff: Mantel TV view — "Side veil" (5B)

## Overview
Always-on family portal for a Samsung Frame 75" TV (Raspberry Pi + Chromium kiosk, React SPA at `/tv`). The chosen design is **5B "Side veil"**: a full-bleed family photo fills the screen; a dark gradient veil rises from the left edge and carries a single quiet column — greeting, clock, date + weather, today/tomorrow calendar, and tasks. It should read as framed décor, not a dashboard.

## About the Design Files
The files in this bundle are **design references created in HTML** — they show the intended look, not production code. Recreate this design in the target codebase's existing environment (**React + Tailwind v4**) using its established patterns. Do not ship the HTML directly.

- `reference-5b.html` — static, pixel-accurate reference of the 5B screen. Open in a browser at 1920×1080 (or any 16:9 window; it scales).
- `tokens.css` — the Tailwind v4 `@theme` block, ready to drop into the app's CSS.
- `sample-photo.png` — a generated, deliberately non-photographic placeholder used by the reference (see the note at the bottom).

## Fidelity
**High-fidelity.** Colors, typography, spacing, and copy treatment are final. Recreate pixel-perfectly at the 1920×1080 logical canvas (the TV renders at 3840×2160; everything scales 2× cleanly — use logical px throughout).

## Hard constraints
- Author at **1920×1080 logical px**. Nothing readable below **26px**.
- **Safe area**: all content inside 96px horizontal / 60px vertical insets (TV overscan).
- **No interactivity**: no hover/focus/click/scroll states, ever. One screen, no scrolling.
- Lists **cap, never clip**: calendar section max 3 rows, tasks max 3 rows; overflow renders one faint line `+ n more` (27px Instrument Sans, `ink-faint-photo`).

## Screen layout (1920×1080)
Three stacked layers:

1. **Photo layer** — `absolute inset-0`, `object-fit: cover`. Slow Ken Burns: `scale(1) → scale(1.08)` over ~45s, `ease-in-out`, alternate; also drift `translate` a few px. Pause/crossfade on photo rotation.
2. **Veil (scrim)** — `absolute inset-0`, no blur:
   `background: linear-gradient(100deg, hsl(26 10% 5% / 0.94) 0%, hsl(26 10% 5% / 0.78) 34%, hsl(26 10% 5% / 0) 62%);`
3. **Content column** — `position: absolute; top: 60px; left: 96px; bottom: 60px; width: 560px; display: flex; flex-direction: column;` with a global `text-shadow: 0 2px 28px hsl(26 12% 7% / 0.6)` on the column (insurance against bright photo patches).

## Components (top → bottom of the column)

### Greeting
- Text: `Good morning` / `Good afternoon` / `Good evening` / `Good night` (from `dayPart`).
- Instrument Sans 600, **26px**, `letter-spacing: 0.28em`, uppercase, color `hsl(30 48% 74%)` (photo-mode accent).

### Clock
- `margin-top: 16px`, flex row, `align-items: baseline`, `gap: 16px`.
- Time (`8:25`): Newsreader 400, **120px/1**, `letter-spacing: -0.01em`, `font-variant-numeric: tabular-nums`, color `ink-photo` `hsl(36 30% 94%)`.
- Meridiem (`PM`): Newsreader 300, **44px**, color `ink-dim-photo` `hsl(32 16% 76%)`.

### Date + weather line
- `margin-top: 12px`. Date: Newsreader 300 italic, **34px**, `ink-dim-photo`.
- Inline after a `·`: `65° Clear` in Instrument Sans 400, **30px**, non-italic, same color. (High/low lives only in solid mode / other layouts; keep this line short.)

### Divider
- `height: 1px; background: hsl(36 20% 80% / 0.18); margin-top: 38px;`

### Section label (used twice: "Tonight & tomorrow", "Tasks")
- Instrument Sans 600, **26px**, `letter-spacing: 0.24em`, uppercase, `ink-dim-photo`.
- Margins: first label `margin-top: 34px`, second `margin-top: 44px`.

### Calendar row (max 3)
- Flex row, `align-items: baseline`, `gap: 14px`; first row `margin-top: 20px`, rest `16px`.
- Dot: 11px circle, person color, `transform: translateY(-2px)`.
- Title: Newsreader 400, **34px/1.25**; next-up event in `ink-photo`, later events in `hsl(36 20% 84%)`.
- Meta (time / day) inline after title: Instrument Sans 400, **27px**, `ink-dim-photo`. E.g. `Movie night 7:30 PM`, `Dim sum with Nana Tomorrow 10:00`.

### Task row (max 3)
- Same geometry as calendar rows (first `margin-top: 20px`, rest `16px`).
- **Open task**: 11px circle **ring** — `border: 2px solid <person color>`, transparent fill, `box-sizing: border-box`, `translateY(-1px)`. Title in `ink-photo`, person name as 27px meta.
- **Done task**: filled 11px dot, whole row `opacity: 0.4`, meta suffix `· done`. No strikethrough, no checkbox.
- Completed items sort last.

### Status indicator
- 8px circle, `background: hsl(36 20% 80% / 0.25)`, pinned to the bottom of the column (`margin-top: auto`). Nearly invisible by design; never style it up.

### Empty states
- No events: replace calendar rows with one line, Newsreader 400 italic, **34px**, `ink-dim-photo`: `Nothing on the calendar today.`
- No tasks: omit the Tasks label + rows entirely (don't show an empty section).

## Interactions & Behavior
- **No pointer/keyboard interactions.** Kiosk only.
- `dayPart` drives greeting and content emphasis: morning/afternoon → lead with **Today**; evening/night → lead with **Tonight & tomorrow** (as shown).
- Clock ticks per minute; date rolls at midnight; weather refreshes on its own cadence.
- Photo rotation: crossfade ~1.5s between photos; restart Ken Burns per photo.
- **Fallback (no photo queued)**: drop the photo + veil layers, set the page background to `surface` `hsl(26 12% 8%)`, and switch ink tokens to solid-mode values (see tokens.css). Everything else is unchanged.

## State Management
- `dayPart: 'morning' | 'afternoon' | 'evening' | 'night'` (derived from clock).
- `events: { title, time, person, location?, allDay? }[]` for today + tomorrow; cap 3 rendered, `+ n more`.
- `tasks: { title, person, done }[]`; cap 3, done last.
- `photo: { url } | null` → photo mode vs solid fallback.
- `weather: { temp, condition, high, low }`.
- `live: boolean` → status dot opacity (live 0.25 / demo 0.5).

## Design Tokens
Full set in `tokens.css`. Summary:
- Surface `hsl(26 12% 8%)` · scrim base `hsl(26 10% 5%)`.
- Photo-mode ink: `ink-photo hsl(36 30% 94%)`, `ink-soft-photo hsl(36 20% 84%)`, `ink-dim-photo hsl(32 16% 76%)`, `ink-faint-photo hsl(30 10% 58%)`, hairline `hsl(36 20% 80% / 0.18)`, accent `hsl(30 48% 74%)`.
- Solid-mode ink: `ink hsl(36 28% 91%)`, `ink-soft hsl(36 20% 82%)`, `ink-dim hsl(32 10% 64%)`, `ink-faint hsl(30 8% 46%)`, `line hsl(30 10% 20%)`, accent `hsl(22 42% 68%)`.
- Person palette (matched lightness ~65%, low chroma): clay `hsl(16 45% 68%)`, ochre `hsl(42 48% 62%)`, sage `hsl(115 18% 60%)`, harbor `hsl(210 28% 68%)`, heather `hsl(310 16% 68%)`. Always paired with the person's name — color is never the only signal.
- Fonts (Google Fonts via `<link>` in `index.html`):
  - **Newsreader** — `ital,opsz,wght@0,6..72,300..600;1,6..72,300..600` (request the `opsz` axis; it matters at 120px).
  - **Instrument Sans** — 400/500/600.

## Contrast notes
All photo-mode text is computed against the veiled photo, not the raw one: the veil guarantees ≥ 0.78 alpha of `hsl(26 10% 5%)` behind every glyph (column ends at x=656, veil holds ≥0.78 to x≈653 of 1920… keep the column inside the 34% stop). `ink-photo` ≈ 14:1 on the veil floor; `ink-dim-photo` ≈ 7:1; nothing readable below 26px. The 100° angle keeps the veil off the photo's right two-thirds.

## Assets
- `sample-photo.png` — a **generated** warm gradient, not a photograph. It carries a realistic tonal range (bright subject-ish region, vignetted corners) so the veil and the photo-mode ink can be judged against something a real photo would resemble. It is deliberately synthetic: no family photo is committed to this repo, ever, and `dev-photos/` is gitignored so you can drop a real image in locally without it reaching a build. Production photos arrive via the mobile app; always `object-fit: cover`.
- No icons, no logos. Type + dots only.

## Files
- `reference-5b.html` — open directly; matches this spec.
- `tokens.css` — Tailwind v4 `@theme` block.
- The full exploration (all candidate layouts + color studies) lives in the design project as `Mantel Spec.dc.html`.
