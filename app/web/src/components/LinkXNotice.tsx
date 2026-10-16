"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

/** Shown to signed-in people who have not linked X yet: without it, "@arctisans post this" is refused. */
export function LinkXNotice() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try { if (localStorage.getItem("arc_linkx_hide")) return; } catch {}
    fetch("/api/x/link", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j && j.enabled && !j.link) setShow(true); })
      .catch(() => {});
  }, []);
  if (!show) return null;
  return (
    <div className="mx-5 mt-4 flex items-center gap-3 rounded-[20px] bg-bg-2 px-4 py-3.5">
      <div className="min-w-0 flex-1">
        <div className="text-[14.5px] font-medium leading-tight">Post from X in one reply</div>
        <div className="mt-0.5 text-[12.5px] leading-snug text-muted">Link your X account once, then reply &ldquo;@arctisans post this&rdquo; to any of your posts.</div>
      </div>
      <Link href="/settings/x" className="press shrink-0 rounded-full bg-[var(--fg)] px-4 py-2 text-[13px] font-semibold text-[var(--bg)]">Link X</Link>
      <button aria-label="Dismiss" onClick={() => { try { localStorage.setItem("arc_linkx_hide", "1"); } catch {} setShow(false); }} className="shrink-0 px-1 text-[18px] leading-none text-faint">&times;</button>
    </div>
  );
}
