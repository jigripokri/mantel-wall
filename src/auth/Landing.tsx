import { SignInForm } from "./SignIn";
import { FAMILY } from "../config/family";

/**
 * The public face of the project, shown at `/` to anyone without a session.
 *
 * Written for a family, not an engineer. Whoever lands here should understand
 * what the thing does for them within about fifteen seconds — the architecture
 * is a footnote at the bottom, not the pitch.
 *
 * No real family data appears here, and no family member is named. The wall
 * preview is a composed mock, not a render of `entries`, so this page stays
 * safe to show publicly while `/tv` stays closed.
 */
export function Landing() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-20 sm:py-28">
      <header>
        <h1 className="font-display text-6xl leading-none text-[var(--color-ink)] sm:text-7xl">
          Mantel
        </h1>
        <p className="mt-6 font-display text-2xl leading-snug text-[var(--color-ink-soft)] sm:text-3xl">
          A mantel is the shelf a family already gathers at and sets things on.
          This is that, on a wall.
        </p>
        <p className="mt-6 max-w-xl leading-relaxed text-[var(--color-ink-dim)]">
          A quiet screen in the living room that shows your family's day — and
          your photographs the rest of the time.
        </p>
      </header>

      <WallPreview />

      <section className="mt-20">
        <p className="max-w-xl text-xl leading-relaxed text-[var(--color-ink-soft)]">
          Every family runs on the same few questions. Is there school tomorrow?
          Who's doing pickup? What time is the thing?
        </p>
        <p className="mt-5 max-w-xl leading-relaxed text-[var(--color-ink-dim)]">
          They get asked at the worst moments — in the car, at bedtime, halfway
          out the door — and the answer is always buried in somebody's phone. So
          one person ends up holding the whole schedule in their head, and
          everyone else has to ask them.
        </p>
        <p className="mt-5 max-w-xl text-xl leading-relaxed text-[var(--color-ink-soft)]">
          Mantel puts the answer on the wall, where nobody has to ask for it.
        </p>
      </section>

      <section className="mt-20">
        <dl className="space-y-10">
          <Item title="The day, in one glance">
            What's on today and what's coming tomorrow, in type big enough to
            read from the sofa. Colour-coded by person, so you can tell at a
            distance whose day it is.
          </Item>

          <Item title="You don't check it — you walk past it">
            There's no app to open and nothing to log into. It's already on,
            already showing the right thing. You catch it on the way to the
            kitchen and you're caught up.
          </Item>

          <Item title="It keeps itself up to date">
            Add something to your shared family calendar from your phone, the way
            you already do. It's on the wall a few minutes later. Change the
            time, it changes. Cancel it, it disappears. Nobody has to remember to
            update the wall.
          </Item>

          <Item title="Your photographs, the rest of the time">
            When there's nothing urgent to say, it's a picture of your family,
            drifting slowly across the screen. It hangs like a framed print
            because that's what it's meant to be — the calendar is just
            something the picture makes room for.
          </Item>

          <Item title="Only your family can see it">
            The wall is private. Family members sign in once and stay signed in;
            everyone else gets this page. Your calendar and your photographs
            aren't on the open internet.
          </Item>

          <Item title="It doesn't look like a screen">
            No widgets, no grid, no notifications, no blue glow. Just a
            photograph and a quiet column of type. It's designed to be something
            you'd actually hang in a room people sit in.
          </Item>
        </dl>
      </section>

      <section className="mt-20">
        <h2 className="font-text text-sm font-semibold tracking-[0.28em] text-[var(--color-accent)] uppercase">
          How you use it
        </h2>
        <ol className="mt-8 space-y-6">
          <Step n="1" title="Keep one shared family calendar">
            The one you already have. Everyone in the house can add to it from
            their own phone.
          </Step>
          <Step n="2" title="Hang the screen">
            A television on the wall, showing the family's day instead of
            nothing.
          </Step>
          <Step n="3" title="That's the whole thing">
            No setup after the first day. No maintenance. It just keeps being
            right.
          </Step>
        </ol>
      </section>

      <section className="mt-20 border-t border-[var(--color-line)] pt-10">
        <h2 className="font-text text-sm font-semibold tracking-[0.28em] text-[var(--color-accent)] uppercase">
          Family sign-in
        </h2>
        <p className="mt-4 max-w-md text-sm leading-relaxed text-[var(--color-ink-dim)]">
          If your email is on the list, this will let you in.
        </p>
        <div className="mt-5 max-w-md">
          <SignInForm compact />
        </div>
      </section>

      <footer className="mt-16 space-y-3 text-sm leading-relaxed text-[var(--color-ink-faint)]">
        <p className="max-w-xl">
          Built for one family, on a television and a small computer taped to the
          back of it. It runs without a server to maintain, checks the calendar
          every fifteen minutes on its own, and is put together so that adding a
          new kind of thing to the wall is an afternoon rather than a project.
        </p>
        {/* Credit, from src/config/family.ts. Set `credit: null` there to drop
            this line — the MIT licence does not require you to keep it. */}
        {FAMILY.credit && (
          <p>
            Built with love at{" "}
            <a
              href={FAMILY.credit.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--color-ink-dim)] underline decoration-[var(--color-line)] underline-offset-4 transition-colors hover:text-[var(--color-accent)] hover:decoration-[var(--color-accent)]"
            >
              {FAMILY.credit.label}
            </a>
            .
          </p>
        )}
      </footer>
    </main>
  );
}

function Item({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="font-display text-2xl text-[var(--color-ink)]">{title}</dt>
      <dd className="mt-3 max-w-xl leading-relaxed text-[var(--color-ink-dim)]">{children}</dd>
    </div>
  );
}

function Step({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-5">
      <span className="font-display text-2xl leading-none text-[var(--color-accent)]">{n}</span>
      <div>
        <p className="font-display text-xl text-[var(--color-ink)]">{title}</p>
        <p className="mt-2 max-w-lg leading-relaxed text-[var(--color-ink-dim)]">{children}</p>
      </div>
    </li>
  );
}

/**
 * A composed impression of the wall — the 5B "Side veil" layout with invented
 * content. Never reads from `entries`; this page is public and the wall is not.
 */
function WallPreview() {
  return (
    <figure className="mt-16">
      {/* Sized in container units, not viewport units. The figure is capped at
          max-w-3xl, so vw-based type would keep growing on a wide screen while
          the box it lives in did not — the clock would run out of its column.
          cqw ties every size to the figure's own width, which is what the real
          wall does too (a fixed canvas scaled to fit). */}
      <div
        className="@container relative aspect-video w-full overflow-hidden rounded-xl border border-[var(--color-line)]"
        style={{
          // Layered radials standing in for an out-of-focus photograph. The
          // real wall puts a family photo here; this page is public, so it gets
          // light and depth without an actual image.
          background: [
            "radial-gradient(120% 90% at 78% 22%, hsl(30 30% 46% / 0.55), transparent 58%)",
            "radial-gradient(80% 70% at 62% 78%, hsl(18 34% 30% / 0.5), transparent 62%)",
            "radial-gradient(60% 60% at 90% 60%, hsl(40 26% 58% / 0.28), transparent 60%)",
            "linear-gradient(115deg, hsl(26 14% 18%), hsl(26 10% 8%) 70%)",
          ].join(","),
        }}
        aria-hidden="true"
      >
        <div className="mantel-veil absolute inset-0" />
        <div className="absolute inset-y-0 left-0 flex w-[46%] flex-col justify-center pl-[5%]">
          <div className="font-text text-[1.6cqw] font-semibold tracking-[0.28em] text-[var(--color-accent-photo)] uppercase">
            Good evening
          </div>
          <div className="font-display text-[7cqw] leading-none text-[var(--color-ink-photo)]">
            6:41
          </div>
          <div className="font-display text-[1.8cqw] text-[var(--color-ink-dim-photo)] italic">
            Thursday, May 14 · 63° Clear
          </div>
          <div className="mt-[3%] h-px w-[80%] bg-[var(--color-line-photo)]" />
          <div className="mt-[3%] font-text text-[1.3cqw] tracking-[0.28em] text-[var(--color-ink-faint-photo)] uppercase">
            Tomorrow
          </div>
          <ul className="mt-[2%] space-y-[1.4%] font-display text-[1.9cqw] text-[var(--color-ink-photo)]">
            <li className="flex items-baseline gap-[2%]">
              <span
                className="inline-block h-[0.5cqw] w-[0.5cqw] shrink-0 rounded-full"
                style={{ background: "var(--color-person-ochre)" }}
              />
              Swim practice
              <span className="text-[1.4cqw] text-[var(--color-ink-dim-photo)]">7:30 AM</span>
            </li>
            <li className="flex items-baseline gap-[2%]">
              <span
                className="inline-block h-[0.5cqw] w-[0.5cqw] shrink-0 rounded-full"
                style={{ background: "var(--color-person-harbor)" }}
              />
              Parent evening
              <span className="text-[1.4cqw] text-[var(--color-ink-dim-photo)]">6:00 PM</span>
            </li>
          </ul>
        </div>
      </div>
      <figcaption className="mt-3 text-sm text-[var(--color-ink-faint)]">
        The wall, in the evening.
      </figcaption>
    </figure>
  );
}
