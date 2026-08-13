import { useState, type FormEvent } from "react";
import { supabase } from "../lib/supabase";

/**
 * The sign-in form on its own. Access is enforced by RLS
 * (supabase/migrations/0003_auth.sql) — this is only the way in, not the
 * security boundary. An email that isn't on the family allowlist can complete
 * sign-in perfectly well and still see nothing, which is intended.
 *
 * Besides the emailed link there is a code path (verifyOtp): type an 8-digit
 * code and sign in without leaving the page. It exists for the installed
 * (home-screen) app, where a tapped email link opens the system browser — a
 * different storage container — so the link signs Safari in and leaves the app
 * signed out; a code completes sign-in *inside* the app. Until the project has
 * a custom SMTP sender the email itself can't display the code (free-tier
 * Supabase rejects template changes), so codes are minted with the admin API
 * and handed over out-of-band; "Have a sign-in code?" goes straight to the code
 * form WITHOUT requesting a new email, because each new request invalidates the
 * previously minted code.
 */
export function SignInForm({ compact = false }: { compact?: boolean }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "code" | "verifying" | "error">("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!supabase || !email.trim()) return;
    setStatus("sending");
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin + window.location.pathname },
    });
    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }
    setStatus("sent");
    setMessage("Check your email for the sign-in link.");
  }

  async function onVerify(e: FormEvent) {
    e.preventDefault();
    if (!supabase || !code.trim()) return;
    setStatus("verifying");
    setMessage("");
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: "email",
    });
    if (error) {
      // Wrong or expired code — stay on the code form for another try.
      setStatus("code");
      setMessage("That code didn't work — check for typos, or ask for a fresh one.");
      return;
    }
    // Success needs no navigation: useSession's onAuthStateChange sees the new
    // session and the app re-renders signed in.
  }

  if (status === "code" || status === "verifying") {
    return (
      <form onSubmit={onVerify} className="space-y-3">
        <p className="text-[var(--color-ink-soft)]">{message || "Enter your email and the 8-digit code."}</p>
        <label htmlFor="otp-email" className="sr-only">
          Email address
        </label>
        <input
          id="otp-email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-surface-deep)] px-4 py-3 text-[var(--color-ink)] outline-none placeholder:text-[var(--color-ink-faint)] focus:border-[var(--color-accent)]"
        />
        <label htmlFor="otp-code" className="sr-only">
          Sign-in code
        </label>
        <input
          id="otp-code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={8}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          placeholder="8-digit code"
          className="w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-surface-deep)] px-4 py-3 tracking-[0.3em] text-[var(--color-ink)] outline-none placeholder:tracking-normal placeholder:text-[var(--color-ink-faint)] focus:border-[var(--color-accent)]"
        />
        <button
          type="submit"
          disabled={status === "verifying" || code.length < 6 || !email.trim()}
          className="w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-surface-deep)] px-5 py-3 text-[var(--color-ink)] transition-colors hover:border-[var(--color-accent)] disabled:opacity-50"
        >
          {status === "verifying" ? "Signing in…" : "Sign in"}
        </button>
      </form>
    );
  }

  if (status === "sent") {
    return (
      <div className="space-y-3">
        <p className="text-[var(--color-ink-soft)]">{message}</p>
        <button
          type="button"
          onClick={() => {
            setMessage("");
            setStatus("code");
          }}
          className="text-sm text-[var(--color-ink-dim)] underline underline-offset-4"
        >
          Have a sign-in code?
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className={compact ? "flex flex-col gap-2 sm:flex-row" : "space-y-3"}>
      <label htmlFor="email" className="sr-only">
        Email address
      </label>
      <input
        id="email"
        type="email"
        required
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        className="w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-surface-deep)] px-4 py-3 text-[var(--color-ink)] outline-none placeholder:text-[var(--color-ink-faint)] focus:border-[var(--color-accent)]"
      />
      <button
        type="submit"
        disabled={status === "sending"}
        className="shrink-0 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface-deep)] px-5 py-3 text-[var(--color-ink)] transition-colors hover:border-[var(--color-accent)] disabled:opacity-50"
      >
        {status === "sending" ? "Sending…" : "Send link"}
      </button>
      {status === "error" && (
        <p className="text-sm text-[var(--color-ink-dim)] sm:basis-full">{message}</p>
      )}
      <button
        type="button"
        onClick={() => {
          setMessage("");
          setStatus("code");
        }}
        className="text-left text-sm text-[var(--color-ink-dim)] underline underline-offset-4 sm:basis-full"
      >
        Have a sign-in code?
      </button>
    </form>
  );
}

/**
 * The wall's signed-out state. Deliberately austere — this is a 75" panel in a
 * living room, not a page anyone browses. It should read as a closed shutter,
 * never as an error, and never as marketing.
 */
export function WallGate() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-[var(--color-surface)]">
      <div className="w-[30rem] text-center">
        <h1 className="font-display text-6xl text-[var(--color-ink)]">Mantel</h1>
        <p className="mt-4 text-xl text-[var(--color-ink-dim)]">This wall is signed out.</p>
        <div className="mt-10 text-left">
          <SignInForm />
        </div>
      </div>
    </div>
  );
}
