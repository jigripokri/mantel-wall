import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { HAS_SUPABASE, supabase } from "../lib/supabase";
import { useSession } from "../lib/useSession";
import { useSetting } from "../lib/useSetting";
import { LAYOUTS, DEFAULT_LAYOUT_ID } from "../tv/layouts";
import type { TvTheme } from "../lib/tvTheme";
import {
  DEFAULT_STAR_BANK,
  REWARD_GROUPS,
  CUSTOM_REWARD_ICON,
  isFull,
  addStar,
  noteLastStar,
  resetWeek,
  setReward,
  starColor,
  starGiverAt,
  starGlow,
  withAlpha,
  type StarBank,
  type StarEvent,
  type StarReward,
} from "../lib/starBank";
import { useFamily } from "../lib/useFamily";
import { FAMILY, accentColor } from "../config/family";
import { fmtTime, fmtPastDayLabel, homeDayNumber } from "../lib/time";
import { resizeImage } from "../lib/resizeImage";
import { Landing } from "../auth/Landing";

/**
 * The companion app — Claude Design direction 1f "Night sky" (locked). One calm
 * scroll built around the star action: an indigo sky-plate with the reward as a
 * moon, a big gold "Add a star" the thumb reaches for, then the wall switch and
 * the (dimmed) future homes. Square corners everywhere but circles — the Mantel
 * tell. Dark skin for v1; the light "oat" skin, the full star-landed spring, and
 * the 6×3 emoji pad are deferred (see the design spec).
 */
const C = {
  surface: "hsl(26 12% 8%)",
  card: "hsl(26 10% 13%)",
  line: "hsl(30 10% 20%)",
  ink: "hsl(36 28% 91%)",
  inkSoft: "hsl(36 20% 82%)",
  inkDim: "hsl(32 10% 64%)",
  inkFaint: "hsl(30 8% 46%)",
  accent: "hsl(22 42% 68%)",
  star: "hsl(44 74% 56%)",
  sky: "linear-gradient(168deg, hsl(250 22% 13%) 0%, hsl(26 14% 10%) 100%)",
} as const;

// Same stepping-stone field as the wall's D5, scattered at three sizes so the
// plate reads as a little piece of sky. x/y are percentages of the field.
const SKY: [number, number][] = [
  [8, 66], [19, 32], [27, 78], [38, 44], [47, 20],
  [55, 70], [64, 38], [73, 82], [81, 52], [89, 26],
]; // prettier-ignore
const SKY_SIZES = [30, 24, 27, 22, 26, 23, 29, 21, 25, 28];
/** Sparkles lifting off the moon while the row stands full — the phone's echo of
 *  the wall's standing glow (see StarBankView in OatMoss). */
const MOON_SPARKS = [
  { right: 18, size: 13, delay: 0 },
  { right: 46, size: 10, delay: 900 },
  { right: 68, size: 12, delay: 1800 },
  { right: 32, size: 9, delay: 2700 },
];
const NUM = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];

export function PhoneHome() {
  const { email, loading, open } = useSession();
  // Which configured person this sign-in is, via the RLS-gated family_members
  // roster. Cosmetic only — it decides a star's tint, never who may give one.
  const { giverOf } = useFamily();
  const layout = useSetting("tv_layout", DEFAULT_LAYOUT_ID);
  const theme = useSetting<TvTheme>("tv_theme", "auto");
  const bank = useSetting<StarBank>("star_bank", DEFAULT_STAR_BANK);
  const [sheet, setSheet] = useState<null | "reward" | "wall" | "photo" | "history">(null);
  const [landed, setLanded] = useState(false);

  if (!open) {
    if (loading) return <div className="min-h-full" style={{ background: C.surface }} />;
    if (!email) return <Landing />;
  }

  const b = bank.value;
  const full = isFull(b);
  const remaining = Math.max(0, b.goal - b.stars);
  const initial = (email?.[0] ?? FAMILY.starBank.childName[0] ?? "M").toUpperCase();
  const activeLayout = LAYOUTS.find((l) => l.id === layout.value) ?? LAYOUTS[0];

  const greeting = full
    ? `${b.reward.label} unlocked`
    : b.stars === 0
      ? `${b.name}'s week`
      : `${NUM[b.stars] ?? b.stars} star${b.stars === 1 ? "" : "s"} up`;

  const tapStar = () => {
    if (full) {
      bank.setValue((v) => resetWeek(v));
    } else {
      bank.setValue((prev) => addStar(prev, giverOf(email)));
      setLanded(true);
    }
  };

  return (
    <div
      className="mx-auto min-h-full max-w-[430px]"
      style={{ background: C.surface, color: C.ink, fontFamily: "var(--font-text)" }}
    >
      <div className="px-6 pt-8 pb-10">
        {/* Header — eyebrow, spoken greeting, then the wall link and profile */}
        <div className="flex items-start justify-between">
          <div>
            <div
              className="font-text font-semibold uppercase"
              style={{ fontSize: 13, letterSpacing: "0.3em", color: C.accent }}
            >
              Mantel
            </div>
            <div className="mt-2 font-display" style={{ fontSize: 36, lineHeight: 1.1, color: C.ink }}>
              {greeting}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {/* Open the wall — for showing off what's on the TV. */}
            <Link
              to="/tv"
              aria-label="Open the wall"
              title="Open the wall"
              className="flex h-10 w-10 items-center justify-center rounded-full"
              style={{ border: `1px solid ${C.line}`, color: C.inkDim }}
            >
              <svg
                width="19"
                height="19"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <rect x="3" y="4" width="18" height="13" rx="2" />
                <path d="M8 21h8" />
                <path d="M12 17v4" />
              </svg>
            </Link>
            <button
              onClick={() => supabase?.auth.signOut()}
              aria-label="Sign out"
              className="flex h-10 w-10 items-center justify-center rounded-full"
              style={{ border: `1px solid ${C.line}`, color: C.inkDim, fontSize: 15, fontWeight: 500 }}
            >
              {initial}
            </button>
          </div>
        </div>

        {/* Star plate — the night sky */}
        <div className="mt-6" style={{ background: C.sky, paddingBottom: 26 }}>
          <div className="relative overflow-hidden" style={{ height: 180 }}>
            {SKY.map(([x, y], i) => {
              const earned = i < b.stars;
              const size = earned ? SKY_SIZES[i] : 5;
              // Tinted by who gave it; unknown and legacy stars take the neutral.
              const color = starColor(starGiverAt(b, i));
              return (
                <div
                  key={i}
                  // Twinkles only on a full row, exactly as the wall does — the
                  // phone and the wall should agree that the week is won.
                  className={`font-display absolute text-center${full ? " mantel-twinkle" : ""}`}
                  style={{
                    left: `${x}%`,
                    top: `${y}%`,
                    width: size,
                    height: size,
                    marginLeft: -size / 2,
                    marginTop: -size / 2,
                    borderRadius: "50%",
                    background: earned ? "transparent" : "hsl(40 20% 70% / 0.28)",
                    color: earned ? color : "transparent",
                    fontSize: size,
                    lineHeight: 1,
                    textShadow: earned ? starGlow(color, full ? 20 : 14) : undefined,
                    ["--delay" as string]: `${i * 190}ms`,
                  }}
                  aria-hidden
                >
                  {earned ? "★" : ""}
                </div>
              );
            })}
            {Array.from({ length: 14 }).map((_, i) => (
              <span
                key={`d${i}`}
                className="absolute"
                style={{
                  left: `${(7 + i * 24.5) % 96}%`,
                  top: `${(19 + i * 47) % 90}%`,
                  width: 2,
                  height: 2,
                  borderRadius: "50%",
                  background: "hsl(40 40% 88%)",
                  opacity: 0.1 + ((i * 7) % 5) * 0.06,
                }}
                aria-hidden
              />
            ))}
            {/* the reward, a moon — it breathes and throws sparkles once the
                row is full, and keeps doing it until a fresh week */}
            <div
              className={`absolute flex items-center justify-center${full ? " mantel-breathe" : ""}`}
              style={{
                right: 22,
                top: 26,
                width: 62,
                height: 62,
                borderRadius: "50%",
                background: "hsl(26 14% 12%)",
                border: `1px solid ${full ? C.star : "hsl(44 50% 42%)"}`,
                fontSize: 30,
                boxShadow: full ? "0 0 30px hsl(44 74% 56% / 0.4)" : undefined,
              }}
              aria-hidden
            >
              {b.reward.icon}
            </div>
            {full &&
              MOON_SPARKS.map((s, i) => (
                <span
                  key={`spark${i}`}
                  className="mantel-lift font-display absolute leading-none"
                  style={{
                    right: s.right,
                    top: 30,
                    fontSize: s.size,
                    color: C.star,
                    textShadow: `0 0 12px ${withAlpha(C.star, 0.8)}`,
                    ["--delay" as string]: `${s.delay}ms`,
                  }}
                  aria-hidden
                >
                  ✦
                </span>
              ))}
          </div>

          <div className="flex items-baseline justify-between px-6">
            <div className="font-display" style={{ fontSize: 21, lineHeight: 1.3, color: C.inkSoft }}>
              {full ? `${b.reward.label} — earned!` : `${remaining} more to ${b.reward.label}`}
            </div>
            <button onClick={() => setSheet("reward")} style={{ fontSize: 17, color: C.accent }}>
              Change ›
            </button>
          </div>

          <button
            onClick={tapStar}
            className="mx-6 mt-[22px] flex w-[calc(100%-48px)] items-center justify-center gap-[14px] active:scale-[0.98]"
            style={{
              height: 96,
              background: C.star,
              boxShadow: "0 0 44px hsl(44 74% 56% / 0.22)",
              transition: "transform 90ms",
            }}
          >
            <span style={{ fontSize: 30, lineHeight: 1 }}>{full ? "↺" : "★"}</span>
            <span className="font-display" style={{ fontSize: 27, lineHeight: 1, color: C.surface }}>
              {full ? "Start a new week" : "Add a star"}
            </span>
          </button>
        </div>

        {/* Wall switch */}
        <button
          onClick={() => setSheet("wall")}
          className="mt-4 flex w-full items-center gap-[14px] px-[22px]"
          style={{ background: C.card, paddingTop: 20, paddingBottom: 20 }}
        >
          <LayoutSwatch id={activeLayout.id} />
          <span className="flex-1 text-left font-display" style={{ fontSize: 19, color: C.ink }}>
            {activeLayout.label}
          </span>
          <span style={{ fontSize: 17, color: C.inkDim }}>Switch ›</span>
        </button>

        {/* Force the board's dark skin regardless of the hour (Side veil is
            always dark, so this only shows on the day-switching board). */}
        <button
          onClick={() => theme.setValue(theme.value === "dark" ? "auto" : "dark")}
          className="mt-3 flex w-full items-center gap-[14px] px-[22px]"
          style={{ background: C.card, paddingTop: 18, paddingBottom: 18 }}
        >
          <span style={{ fontSize: 19, lineHeight: 1 }} aria-hidden>
            🌙
          </span>
          <span className="flex-1 text-left font-display" style={{ fontSize: 19, color: C.ink }}>
            Keep the wall dark
          </span>
          <Toggle on={theme.value === "dark"} />
        </button>

        {/* Photo is live now; Chores stays dimmed until it ships. */}
        <div className="mt-3 flex gap-3">
          <button
            onClick={() => setSheet("photo")}
            className="flex-1 text-left font-display"
            style={{ background: C.card, padding: "18px 20px", fontSize: 17, color: C.ink }}
          >
            ＋ Photo
          </button>
          <div
            className="flex-1 font-display"
            style={{ background: C.card, padding: "18px 20px", opacity: 0.5, fontSize: 17, color: C.inkDim }}
          >
            ◇ Chores
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 flex items-center justify-between" style={{ color: C.inkFaint, fontSize: 15 }}>
          <button onClick={() => bank.setValue((v) => resetWeek(v))}>Start a new week</button>
          <button onClick={() => setSheet("history")}>History</button>
          <a href="/about" style={{ color: C.inkFaint }}>
            About
          </a>
        </div>

        {!HAS_SUPABASE && (
          <p className="mt-6" style={{ fontSize: 13, color: C.inkFaint }}>
            Running on demo data — connect Supabase to go live.
          </p>
        )}
      </div>

      {sheet === "reward" && (
        <RewardSheet bank={b} onPick={(r) => bank.setValue((v) => setReward(v, r))} onClose={() => setSheet(null)} />
      )}
      {sheet === "wall" && (
        <WallSheet
          activeId={activeLayout.id}
          onPick={(id) => layout.setValue(id)}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === "photo" && <PhotoSheet email={email} onClose={() => setSheet(null)} />}
      {sheet === "history" && <HistorySheet log={b.log ?? []} onClose={() => setSheet(null)} />}
      {landed && (
        <StarLanded
          stars={b.stars}
          goal={b.goal}
          reward={b.reward}
          color={starColor(giverOf(email))}
          onNote={(note) => bank.setValue((v) => noteLastStar(v, note))}
          onDismiss={() => setLanded(false)}
        />
      )}
    </div>
  );
}

/** A tiny non-screenshot rendering of a layout, for the wall card/tiles. */
function LayoutSwatch({ id, size = 52 }: { id: string; size?: number }) {
  // Both board variants (mantelpiece and stack) wear the oat-to-moss swatch.
  const oat = id.startsWith("oat-moss");
  return (
    <span
      className="shrink-0 overflow-hidden"
      style={{
        width: size,
        height: size * 0.66,
        background: oat
          ? "linear-gradient(158deg, hsl(30 32% 89%), hsl(100 20% 86%))"
          : "linear-gradient(100deg, hsl(26 10% 5%) 0%, hsl(26 10% 5% / 0.5) 55%, hsl(28 16% 28%) 100%)",
      }}
      aria-hidden
    />
  );
}

/** A small on/off switch — gold pill when on, matching the star action. */
function Toggle({ on }: { on: boolean }) {
  return (
    <span
      className="relative inline-block shrink-0 rounded-full"
      style={{ width: 46, height: 28, background: on ? C.star : C.line, transition: "background 140ms" }}
      role="switch"
      aria-checked={on}
    >
      <span
        className="absolute rounded-full"
        style={{
          top: 3,
          left: on ? 21 : 3,
          width: 22,
          height: 22,
          background: on ? C.surface : C.inkDim,
          transition: "left 140ms",
        }}
      />
    </span>
  );
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: C.surface }}>
      <div
        className="mx-auto flex w-full max-w-[430px] items-center justify-between px-6"
        style={{ paddingTop: 24, paddingBottom: 16 }}
      >
        <span className="font-display" style={{ fontSize: 30, color: C.ink }}>
          {title}
        </span>
        <button onClick={onClose} aria-label="Close" style={{ fontSize: 17, color: C.accent }}>
          Done
        </button>
      </div>
      <div className="mx-auto w-full max-w-[430px] flex-1 overflow-y-auto px-6 pb-10">{children}</div>
    </div>
  );
}

function RewardSheet({
  bank,
  onPick,
  onClose,
}: {
  bank: StarBank;
  onPick: (r: StarReward) => void;
  onClose: () => void;
}) {
  const [emoji, setEmoji] = useState("");
  const [label, setLabel] = useState("");
  const pick = (r: StarReward) => {
    onPick(r);
    onClose();
  };
  return (
    <Sheet title="This week's reward" onClose={onClose}>
      {REWARD_GROUPS.map((g) => (
        <div key={g.name} className="mb-6">
          <div
            className="font-text font-semibold uppercase"
            style={{ fontSize: 12, letterSpacing: "0.22em", color: C.inkFaint, marginBottom: 12 }}
          >
            {g.name}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {g.items.map((r) => {
              const sel = r.label === bank.reward.label;
              return (
                <button
                  key={r.label}
                  onClick={() => pick(r)}
                  className="flex items-center gap-3 px-4 text-left"
                  style={{
                    minHeight: 56,
                    background: sel ? C.card : "transparent",
                    border: `1px solid ${sel ? C.star : C.line}`,
                  }}
                >
                  <span style={{ fontSize: 22, lineHeight: 1 }}>{r.icon}</span>
                  <span className="font-display" style={{ fontSize: 17, color: C.ink }}>
                    {r.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* Make your own — emoji + title */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const t = label.trim();
          if (!t) return;
          pick({ icon: emoji.trim() || CUSTOM_REWARD_ICON, label: t });
        }}
        className="flex items-center gap-2"
        style={{ border: `1px dashed ${C.line}`, padding: 12 }}
      >
        <input
          value={emoji}
          onChange={(e) => setEmoji(e.target.value)}
          placeholder="🎁"
          maxLength={8}
          aria-label="Reward emoji"
          className="text-center"
          style={{ width: 52, height: 44, background: C.card, color: C.ink, fontSize: 20, border: "none", outline: "none" }}
        />
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Make your own…"
          aria-label="Reward title"
          className="flex-1"
          style={{ height: 44, background: C.card, color: C.ink, fontSize: 16, padding: "0 12px", border: "none", outline: "none" }}
        />
        <button type="submit" style={{ height: 44, padding: "0 16px", color: C.inkDim, fontSize: 15 }}>
          Set
        </button>
      </form>
    </Sheet>
  );
}

function WallSheet({
  activeId,
  onPick,
  onClose,
}: {
  activeId: string;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <Sheet title="On the wall" onClose={onClose}>
      <div className="flex flex-col gap-4">
        {LAYOUTS.map((l) => {
          const on = l.id === activeId;
          return (
            <button
              key={l.id}
              onClick={() => {
                onPick(l.id);
                onClose();
              }}
              className="flex items-center gap-4 px-5 text-left"
              style={{
                paddingTop: 20,
                paddingBottom: 20,
                background: C.card,
                border: `1px solid ${on ? C.star : C.line}`,
              }}
            >
              <LayoutSwatch id={l.id} size={72} />
              <span className="flex-1">
                <span className="flex items-center gap-2">
                  <span className="font-display" style={{ fontSize: 20, color: C.ink }}>
                    {l.label}
                  </span>
                  {on && (
                    <span
                      className="font-text uppercase"
                      style={{ fontSize: 11, letterSpacing: "0.16em", color: C.star }}
                    >
                      On the wall
                    </span>
                  )}
                </span>
                <span className="mt-1 block" style={{ fontSize: 14, color: C.inkDim }}>
                  {l.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}

type PhotoRow = { id: string; key: string; url: string; caption: string };

/**
 * Add and manage the wall's photos. Pick a photo, it's downscaled in the browser
 * (resizeImage) and uploaded to the private `photos` bucket, then a `photo`
 * entry is inserted — the wall picks it up over Realtime and switches to photo
 * mode. Removing a photo deletes the row AND the object behind it (0008), which
 * Realtime carries to the wall as a DELETE. All three writes are gated by the
 * family RLS.
 */
function PhotoSheet({ email, onClose }: { email: string | null; onClose: () => void }) {
  const [photos, setPhotos] = useState<PhotoRow[]>([]);
  const [pending, setPending] = useState<{ file: File; url: string } | null>(null);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  /** Which tile is asking "delete for good?" — deletion is irreversible now, and
   *  a bare × next to a thumbnail is a thumb-slip away from losing a photo. */
  const [confirming, setConfirming] = useState<string | null>(null);

  const load = async () => {
    if (!supabase) return;
    const { data } = await supabase
      .from("entries")
      .select("id, media_key, payload")
      .eq("type", "photo")
      .eq("status", "active")
      .order("created_at", { ascending: false });
    const signed = await Promise.all(
      (data ?? []).map(async (r) => {
        const key = r.media_key as string | null;
        if (!key) return null;
        const { data: s } = await supabase!.storage.from("photos").createSignedUrl(key, 3600);
        return s?.signedUrl
          ? {
              id: r.id as string,
              key,
              url: s.signedUrl,
              caption: (r.payload as { caption?: string })?.caption ?? "",
            }
          : null;
      }),
    );
    setPhotos(signed.filter((p): p is PhotoRow => p !== null));
  };

  useEffect(() => {
    void load();
  }, []);

  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setCaption("");
    setPending({ file, url: URL.createObjectURL(file) });
    e.target.value = ""; // allow re-picking the same file
  };

  const confirmUpload = async () => {
    if (!pending || !supabase) return;
    setBusy(true);
    setError("");
    try {
      const blob = await resizeImage(pending.file);
      const key = `uploads/${crypto.randomUUID()}.jpg`;
      const up = await supabase.storage.from("photos").upload(key, blob, { contentType: "image/jpeg" });
      if (up.error) throw up.error;
      const ins = await supabase.from("entries").insert({
        type: "photo",
        source: "upload",
        media_key: key,
        status: "active",
        created_by: email,
        payload: { caption: caption.trim() },
      });
      if (ins.error) throw ins.error;
      URL.revokeObjectURL(pending.url);
      setPending(null);
      setCaption("");
      await load();
    } catch (e) {
      setError((e as Error).message || "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (p: PhotoRow) => {
    if (!supabase) return;
    setBusy(true);
    setError("");
    // The row goes first: it is what the wall reads, so deleting it is the change
    // the family actually asked for, and Realtime carries it to the TV at once.
    // Only then the object — if that second call fails we leave one unreferenced
    // file in a private bucket (invisible, harmless) rather than risk a frame
    // pointing at a photo that no longer exists.
    //
    // The error is checked, unlike the archive this replaces: that call had been
    // failing 403 on every attempt while the UI dropped the tile anyway, so the
    // photo silently came back on the next load.
    const del = await supabase.from("entries").delete().eq("id", p.id);
    if (del.error) {
      setError(del.error.message || "Could not remove that photo.");
      setBusy(false);
      return;
    }
    const obj = await supabase.storage.from("photos").remove([p.key]);
    if (obj.error) console.warn("[photos] row deleted, object remains", p.key, obj.error.message);
    setPhotos((ps) => ps.filter((x) => x.id !== p.id));
    setConfirming(null);
    setBusy(false);
  };

  return (
    <Sheet title="Photos" onClose={onClose}>
      {pending ? (
        <div>
          <img
            src={pending.url}
            alt=""
            className="w-full"
            style={{ maxHeight: 360, objectFit: "cover", background: C.card }}
          />
          <input
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Add a caption (optional)"
            aria-label="Caption"
            className="mt-3 w-full"
            style={{ height: 46, background: C.card, color: C.ink, fontSize: 16, padding: "0 14px", border: "none", outline: "none" }}
          />
          <div className="mt-4 flex gap-3">
            <button
              onClick={confirmUpload}
              disabled={busy}
              className="flex-1 font-display"
              style={{ height: 52, background: C.star, color: C.surface, fontSize: 20, opacity: busy ? 0.6 : 1 }}
            >
              {busy ? "Adding…" : "Add to wall"}
            </button>
            <button
              onClick={() => {
                URL.revokeObjectURL(pending.url);
                setPending(null);
              }}
              disabled={busy}
              style={{ padding: "0 20px", color: C.inkDim, fontSize: 16, border: `1px solid ${C.line}` }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <label
            className="mb-5 flex cursor-pointer items-center justify-center font-display"
            style={{ height: 64, border: `1px dashed ${C.line}`, color: C.ink, fontSize: 19 }}
          >
            ＋ Add a photo
            <input type="file" accept="image/*" onChange={pick} className="hidden" />
          </label>

          {photos.length === 0 ? (
            <p style={{ fontSize: 15, color: C.inkFaint }}>
              No photos on the wall yet. Add one and it appears within a second.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {photos.map((p) => (
                <div key={p.id} className="relative">
                  <img
                    src={p.url}
                    alt={p.caption}
                    className="w-full"
                    style={{ aspectRatio: "1", objectFit: "cover", background: C.card }}
                  />
                  {confirming === p.id ? (
                    <div
                      className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-3 text-center"
                      style={{ background: "hsl(26 12% 8% / 0.88)" }}
                    >
                      <span className="font-display" style={{ fontSize: 16, color: C.ink }}>
                        Delete for good?
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => remove(p)}
                          disabled={busy}
                          className="font-display"
                          style={{
                            padding: "8px 14px",
                            background: "hsl(6 60% 52%)",
                            color: C.ink,
                            fontSize: 15,
                            opacity: busy ? 0.6 : 1,
                          }}
                        >
                          Delete
                        </button>
                        <button
                          onClick={() => setConfirming(null)}
                          disabled={busy}
                          style={{
                            padding: "8px 14px",
                            border: `1px solid ${C.line}`,
                            color: C.inkDim,
                            fontSize: 15,
                          }}
                        >
                          Keep
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirming(p.id)}
                      aria-label="Remove photo"
                      className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full"
                      style={{ background: "hsl(26 12% 8% / 0.8)", color: C.ink, fontSize: 16 }}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
      {error && (
        <p className="mt-4" style={{ fontSize: 14, color: "hsl(6 60% 62%)" }}>
          {error}
        </p>
      )}
    </Sheet>
  );
}

/** The handful of reasons that come up most, as one tap each — the evidence
 *  behind the star bank is about *specific* praise, and a phone keyboard is the
 *  thing most likely to stop a parent bothering. Free text is right there too. */
const QUICK_REASONS = ["Brushing", "Tidying up", "Kindness", "Good listening", "Great try"];

/** The tenth star's burst on the phone. Deliberately smaller than the wall's:
 *  the parent tapping is a foot from the screen, and the wall is where the whole
 *  family is looking. Fixed geometry — no clock, no randomness. */
const PHONE_BURST = Array.from({ length: 18 }, (_, i) => {
  const angle = (i / 18) * Math.PI * 2;
  const reach = [186, 138, 108][i % 3];
  return {
    glyph: i % 2 ? "✦" : "★",
    dx: Math.round(Math.cos(angle) * reach),
    dy: Math.round(Math.sin(angle) * reach),
    size: 14 + (i % 4) * 7,
    rot: (i % 2 ? 1 : -1) * 320,
    delay: (i % 6) * 90,
  };
});

/** A brief celebratory moment when a star lands, and the one place the "why" is
 *  asked for. The star is already banked by the time this shows — the note is
 *  attached afterwards (noteLastStar), so nothing stands between the thumb and
 *  the tap. The auto-dismiss holds as soon as the parent starts writing.
 *
 *  The star that fills the row gets its own version: the prize instead of the
 *  glyph, a burst around it, and a longer hold before it dismisses — the parent
 *  should have time to turn the phone round and show him. The wall is running
 *  its own, far louder burst at the same moment (tv/StarCelebration). */
function StarLanded({
  stars,
  goal,
  reward,
  color,
  onNote,
  onDismiss,
}: {
  stars: number;
  goal: number;
  reward: StarReward;
  color: string;
  onNote: (note: string) => void;
  onDismiss: () => void;
}) {
  const [note, setNote] = useState("");
  const [held, setHeld] = useState(false);
  const remaining = Math.max(0, goal - stars);
  const won = remaining === 0;

  useEffect(() => {
    if (held) return;
    const t = setTimeout(onDismiss, won ? 5200 : 2600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [held]);

  const save = (text: string) => {
    if (text.trim()) onNote(text);
    onDismiss();
  };

  return (
    <div
      onClick={onDismiss}
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center px-6"
      // Opaque base with a glow on top — a spotlight, not a translucent wash, so
      // the count reads cleanly. Tinted to the giver's colour, like the star —
      // except on the last one, which belongs to the prize and goes gold.
      style={{
        background: `radial-gradient(circle at 50% 40%, ${withAlpha(won ? C.star : color, won ? 0.3 : 0.22)}, transparent 60%), hsl(26 11% 6%)`,
      }}
    >
      {won ? (
        <div className="relative flex items-center justify-center" style={{ width: 176, height: 176 }}>
          <div
            className="mantel-ring absolute"
            style={{
              width: 132,
              height: 132,
              borderRadius: "50%",
              border: `2px solid ${withAlpha(C.star, 0.85)}`,
              boxShadow: `0 0 26px ${withAlpha(C.star, 0.5)}`,
            }}
            aria-hidden
          />
          {PHONE_BURST.map((s, i) => (
            <span
              key={i}
              className="mantel-shard font-display absolute leading-none"
              style={{
                fontSize: s.size,
                color: i % 5 === 0 ? accentColor() : C.star,
                textShadow: `0 0 ${s.size}px ${withAlpha(C.star, 0.7)}`,
                ["--dx" as string]: `${s.dx}px`,
                ["--dy" as string]: `${s.dy}px`,
                ["--s" as string]: 1.1,
                ["--rot" as string]: `${s.rot}deg`,
                ["--dur" as string]: "1500ms",
                ["--delay" as string]: `${s.delay}ms`,
              }}
              aria-hidden
            >
              {s.glyph}
            </span>
          ))}
          <span className="mantel-bloom" style={{ fontSize: 108, lineHeight: 1 }} aria-hidden>
            {reward.icon}
          </span>
        </div>
      ) : (
        <span className="mantel-pop" style={{ fontSize: 132, lineHeight: 1, color, textShadow: starGlow(color, 40) }}>
          ★
        </span>
      )}
      <span className="mt-3 font-display" style={{ fontSize: 34, color: C.ink }}>
        {won ? reward.label : `${NUM[stars] ?? stars} ${stars === 1 ? "star" : "stars"}`}
      </span>
      <span className="mt-1" style={{ fontSize: 16, color: won ? C.star : C.inkDim }}>
        {won ? `${NUM[stars] ?? stars} stars — earned!` : `${remaining} more to go`}
      </span>

      <div className="mt-8 w-full max-w-[382px]" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-wrap justify-center gap-2">
          {QUICK_REASONS.map((r) => (
            <button
              key={r}
              onClick={() => save(r)}
              style={{ padding: "9px 14px", fontSize: 15, color: C.inkSoft, border: `1px solid ${C.line}` }}
            >
              {r}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save(note);
          }}
          className="mt-3 flex gap-2"
        >
          <input
            value={note}
            onChange={(e) => {
              setHeld(true);
              setNote(e.target.value);
            }}
            onFocus={() => setHeld(true)}
            placeholder="What was it for?"
            aria-label="What was it for?"
            maxLength={120}
            className="flex-1"
            style={{
              height: 46,
              background: C.card,
              color: C.ink,
              fontSize: 16,
              padding: "0 14px",
              border: "none",
              outline: "none",
            }}
          />
          <button
            type="submit"
            className="font-display"
            style={{ height: 46, padding: "0 18px", fontSize: 17, color: C.inkDim, border: `1px solid ${C.line}` }}
          >
            {note.trim() ? "Save" : "Done"}
          </button>
        </form>
      </div>
    </div>
  );
}

/** Every star, newest first, grouped into home-zone days, with the fresh-week
 *  markers left in — so a week reads as a week and the reasons read as a story
 *  of what got noticed. Read-only by design: history isn't editable, and there
 *  is still no way to take a star back. */
function HistorySheet({ log, onClose }: { log: StarEvent[]; onClose: () => void }) {
  const now = new Date();
  const events = [...log].reverse();

  // Group by calendar day in the home zone — never the phone's own zone, which
  // would file a bedtime star under the wrong day when travelling.
  const days: { key: number; label: string; events: StarEvent[] }[] = [];
  for (const e of events) {
    const at = new Date(e.at);
    const key = homeDayNumber(at);
    const last = days[days.length - 1];
    if (last?.key === key) last.events.push(e);
    else days.push({ key, label: fmtPastDayLabel(now, at), events: [e] });
  }

  const total = log.filter((e) => e.kind === "star").length;

  return (
    <Sheet title="History" onClose={onClose}>
      {total === 0 ? (
        // Also the state a bank written before the log existed lands in: its
        // stars are real, they just predate any history.
        <p style={{ fontSize: 15, color: C.inkFaint }}>
          Nothing logged yet. The next star — and the reason you give for it — shows up here.
        </p>
      ) : (
        <>
          <div style={{ fontSize: 15, color: C.inkFaint, marginBottom: 20 }}>
            {total} star{total === 1 ? "" : "s"} so far
          </div>
          {days.map((d) => (
            <div key={d.key} className="mb-6">
              <div
                className="font-text font-semibold uppercase"
                style={{ fontSize: 12, letterSpacing: "0.22em", color: C.inkFaint, marginBottom: 10 }}
              >
                {d.label}
              </div>
              {d.events.map((e, i) =>
                e.kind === "week" ? (
                  <div key={i} className="flex items-center gap-3" style={{ padding: "10px 0" }}>
                    <span style={{ flex: 1, height: 1, background: C.line }} />
                    <span style={{ fontSize: 13, color: C.inkFaint }}>New week started</span>
                    <span style={{ flex: 1, height: 1, background: C.line }} />
                  </div>
                ) : (
                  <div key={i} className="flex items-baseline gap-3" style={{ padding: "9px 0" }}>
                    <span
                      style={{ fontSize: 17, lineHeight: 1, color: starColor(e.giver) }}
                      aria-hidden
                    >
                      ★
                    </span>
                    <span className="flex-1 font-display" style={{ fontSize: 17, color: e.note ? C.ink : C.inkDim }}>
                      {e.note || "A star"}
                    </span>
                    <span style={{ fontSize: 14, color: C.inkFaint }}>{fmtTime(e.at)}</span>
                  </div>
                ),
              )}
            </div>
          ))}
        </>
      )}
    </Sheet>
  );
}
