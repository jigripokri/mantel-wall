import { useEffect, useState } from "react";
import { supabase, HAS_SUPABASE } from "./supabase";
import { useSession } from "./useSession";
import { personByName } from "../config/family";
import { NEUTRAL_GIVER, type StarGiver } from "./starBank";

/** Resolve a signed-in email to a person id from src/config/family.ts. */
export type GiverResolver = (email: string | null | undefined) => StarGiver;

/**
 * Who is signed in, as one of the people in `src/config/family.ts`.
 *
 * The link is made here, at runtime, rather than in the config file, because
 * the config file is compiled into the public JS bundle and sign-in emails
 * should not be. `family_members` is behind the same `is_family()` RLS as
 * everything else (0003_auth.sql), so the roster is only ever fetched by a
 * session that is already allowed to see it.
 *
 *   family_members.display_name  ==  Person.name   (case-insensitive)
 *
 * Anything that doesn't line up — a member with no `display_name`, a name that
 * isn't in the config, mock mode, a roster that hasn't loaded yet — resolves to
 * the neutral colour. That is a cosmetic fallback, never an access decision:
 * RLS already decided who may write a star.
 */
export function useFamily(): { giverOf: GiverResolver; loading: boolean } {
  const [byEmail, setByEmail] = useState<Record<string, StarGiver>>({});
  const [loading, setLoading] = useState(HAS_SUPABASE);
  const { session, loading: sessionLoading } = useSession();

  useEffect(() => {
    if (!HAS_SUPABASE || !supabase) return; // mock mode: everyone is neutral
    if (sessionLoading) return;
    if (!session) {
      setByEmail({});
      setLoading(false);
      return;
    }

    let cancelled = false;
    supabase
      .from("family_members")
      .select("email, display_name")
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) console.warn("[useFamily] roster read failed", error.message);
        const next: Record<string, StarGiver> = {};
        for (const row of data ?? []) {
          const person = personByName(row.display_name);
          if (person && row.email) next[String(row.email).trim().toLowerCase()] = person.id;
        }
        setByEmail(next);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [session, sessionLoading]);

  return {
    giverOf: (email) => (email ? byEmail[email.trim().toLowerCase()] : undefined) ?? NEUTRAL_GIVER,
    loading,
  };
}
