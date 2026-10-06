"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// Which posts the signed-in person liked: loaded once, shared by every heart on the page, saved on every tap.
let mine: Set<string> | null = null;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();
const load = () => (loading ??= fetch("/api/like", { credentials: "include" }).then((r) => (r.ok ? r.json() : { liked: [] }))
  .then((j: { liked?: string[] }) => { mine = new Set(j.liked ?? []); }, () => { mine = new Set(); })
  .finally(() => { loading = null; listeners.forEach((f) => f()); }));

const real = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

/** Heart state for one post. `base` is the count from the server; we add one if the person's own like is not in it yet. */
export function useLike(postId: string, base: number) {
  const [liked, setLiked] = useState(false);
  const [count, setCount] = useState(base);
  const router = useRouter();
  useEffect(() => {
    if (!real(postId)) return;
    const sync = () => setLiked(!!mine?.has(postId));
    listeners.add(sync);
    if (mine) sync(); else void load();
    return () => { listeners.delete(sync); };
  }, [postId]);

  /** Returns true when this tap turned the like on (so the caller can play the burst). `only` = double-tap: never un-likes. */
  async function toggle(only?: "on"): Promise<boolean> {
    const next = only === "on" ? true : !liked;
    if (next === liked) return false;
    setLiked(next); setCount((c) => Math.max(0, c + (next ? 1 : -1)));
    if (!real(postId)) return next; // sample post: animate only
    const r = await fetch("/api/like", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ postId, like: next }) }).catch(() => null);
    if (r?.ok) {
      const j = (await r.json()) as { likes?: number };
      if (typeof j.likes === "number") setCount(j.likes);
      if (!mine) mine = new Set();
      if (next) mine.add(postId); else mine.delete(postId);
      listeners.forEach((f) => f());
    } else {
      setLiked(!next); setCount((c) => Math.max(0, c + (next ? -1 : 1))); // did not save: put it back
      if (r?.status === 401) router.push("/signup");
    }
    return next;
  }
  return { liked, count, toggle };
}
