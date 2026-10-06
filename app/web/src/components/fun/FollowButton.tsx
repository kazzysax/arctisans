"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// Who the signed-in person follows: loaded once, shared by every Follow button on the page, kept in step with each tap.
let mine: Set<string> | null = null;
let loading: Promise<Set<string>> | null = null;
const listeners = new Set<() => void>();
const load = () => (loading ??= fetch("/api/follow", { credentials: "include" }).then((r) => (r.ok ? r.json() : { following: [] }))
  .then((j: { following?: string[] }) => (mine = new Set((j.following ?? []).map((x) => x.toLowerCase()))), () => (mine = new Set()))
  .finally(() => { loading = null; listeners.forEach((f) => f()); }));

/** Follow springs into a check, then settles as "Following". `onPhoto` = white style for photo chips. With `wallet` it is saved for real; without it (sample people) it only animates. */
export function FollowButton({ onPhoto = false, size = "md", initial = false, wallet }: { onPhoto?: boolean; size?: "sm" | "md"; initial?: boolean; wallet?: string }) {
  const key = wallet?.toLowerCase();
  const [on, setOn] = useState(initial);
  const [burst, setBurst] = useState(0);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  useEffect(() => {
    if (!key) return;
    const sync = () => setOn(!!mine?.has(key));
    listeners.add(sync);
    if (mine) sync(); else void load();
    return () => { listeners.delete(sync); };
  }, [key]);

  async function tap() {
    if (busy) return;
    const next = !on;
    if (!key) { setOn(next); if (next) setBurst((b) => b + 1); return; } // sample person
    setOn(next); if (next) setBurst((b) => b + 1); setBusy(true);
    const r = await fetch("/api/follow", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ wallet: key, follow: next }) }).catch(() => null);
    setBusy(false);
    if (r?.ok) { if (!mine) mine = new Set(); if (next) mine.add(key); else mine.delete(key); listeners.forEach((f) => f()); return; }
    setOn(!next); // did not save: put it back
    if (r?.status === 401) router.push("/signup");
  }
  const h = size === "sm" ? "h-8 px-3.5 text-[12px]" : "h-10 px-4 text-[13px]";
  const solid = onPhoto ? "bg-white text-black" : "bg-pill text-pill-fg";
  const ghost = onPhoto ? "border border-white/30 text-white" : "hairline-strong text-fg";
  return (
    <button
      onClick={tap}
      aria-pressed={on}
      className={`press inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full font-medium transition-[background,color,border-color] duration-300 ${h} ${on ? ghost : solid}`}
    >
      {on && (
        <svg key={burst} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ animation: "pop 520ms var(--spring) both" }} aria-hidden>
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      )}
      {on ? "Following" : "Follow"}
    </button>
  );
}
