# Mantel

A family portal for a wall-mounted TV — the household's calendar, chores and
photos, rendered as something you'd actually want hanging in a living room
rather than a dashboard someone forgot to close.

One React SPA, two routes: **`/tv`** is the wall, **`/`** is the phone companion.
The backend is Supabase; there is **no server to write or run**.

```bash
npm install && npm run dev
```

That's the whole setup. It runs on mock data with **no accounts, no database, no
API keys** — open <http://localhost:5000/tv> and the wall is there, fully
working. Wire it to a real backend later, or never.

## What it does

- **Calendar** — pulls ICS feeds on a schedule, expands recurrences, colour-codes
  events per person from a `Name: ` title prefix.
- **Star bank** — a weekly reward chart for a kid. Additive only, by design: a
  parent taps a star and says why, the reason is kept, and filling the row throws
  a nine-second celebration across the whole screen.
- **Photos** — family uploads from a phone, rotating on the wall behind the type.
- **Weather**, **todos**, and a freshness indicator so a silently-dead sync
  can't masquerade as an empty week.

Everything lands in one `entries` table and renders as a tile. Adding a new kind
of thing to the wall is an afternoon, not a project — that contract is
[`MODULES.md`](MODULES.md).

## Make it yours

Everything that names a person is in one file:
[`src/config/family.ts`](src/config/family.ts). Edit it, and the wall, the phone,
the star colours and the celebration all follow.

Using [Claude Code](https://claude.com/claude-code)? This repo ships two slash
commands:

- **`/setup`** — interviews you, rewrites `src/config/family.ts`, verifies, and
  shows you the result. No accounts needed.
- **`/provision`** — drives the whole Supabase + Vercel deployment, stopping to
  hand you the browser for the logins it can't do.

Full runbook, by hand or by agent: **[`SETUP.md`](SETUP.md)**.

## Stack

React 19 · Vite · TypeScript · Tailwind v4 · react-router ·
`@supabase/supabase-js`. Edge Functions are Deno. Hosting is Vercel, but nothing
about the app is Vercel-specific beyond one rewrite rule.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server on :5000 |
| `npm run build` | `tsc -b` + production build → `dist/` |
| `npm run check` | Typecheck only |
| `npm run lint` | ESLint |
| `npm run test` | Vitest — every suite runs twice, under `TZ=UTC` and `TZ=America/Los_Angeles` |
| **`npm run verify`** | **typecheck → lint → test → build. The gate.** |
| `npm run db:push` | Apply migrations to the linked Supabase project |

The two-timezone test run isn't decoration. Ingest runs in Deno (UTC) and the
wall runs on a Pi in your living room; anything derived from the host's zone
diverges between them silently. See the note in
[`CLAUDE.md`](CLAUDE.md#gotchas).

## Docs

- [`SETUP.md`](SETUP.md) — fork → configure → deploy → hang on a wall.
- [`MODULES.md`](MODULES.md) — the Feature Module contract. Read before adding a feature.
- [`CLAUDE.md`](CLAUDE.md) — how to work in this repo, for humans and agents.
- [`tasks/`](tasks/) — self-contained feature specs, and a template for your own.
- [`docs/TITLE-CONVENTION.md`](docs/TITLE-CONVENTION.md) — the calendar title grammar.

## Contributing

Issues and PRs welcome — see [`CONTRIBUTING.md`](CONTRIBUTING.md). The one hard
rule: `npm run verify` must be green, and the app must still run with no Supabase
account configured.

## License

MIT — see [`LICENSE`](LICENSE). Fork it, change it, hang it on your own wall.
