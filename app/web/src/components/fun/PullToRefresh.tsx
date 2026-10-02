"use client";
import { useEffect, useRef, useState } from "react";

const MAX = 110, TRIGGER = 72;
/** Pull the feed down: the Arctisans arc draws itself with the pull, the dot drops in when it's ready, then it refreshes. */
export function PullToRefresh({ children, onRefresh }: { children: React.ReactNode; onRefresh?: () => Promise<void> | void }) {
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const start = useRef<number | null>(null);
  const pullRef = useRef(0);
  const busyRef = useRef(false);

  useEffect(() => {
    const down = (e: TouchEvent) => { if (scrollY <= 0 && !busyRef.current) { start.current = e.touches[0].clientY; setDragging(true); } };
    const move = (e: TouchEvent) => {
      if (start.current === null) return;
      const d = e.touches[0].clientY - start.current;
      if (d <= 0) { pullRef.current = 0; setPull(0); return; }
      const v = Math.min(MAX, d * 0.5); // resistance
      pullRef.current = v; setPull(v);
      if (e.cancelable) e.preventDefault();
    };
    const up = async () => {
      if (start.current === null) return;
      start.current = null; setDragging(false);
      if (pullRef.current >= TRIGGER) {
        busyRef.current = true; setBusy(true); setPull(64);
        await Promise.all([onRefresh?.(), new Promise((r) => setTimeout(r, 1100))]);
        busyRef.current = false; setBusy(false);
      }
      pullRef.current = 0; setPull(0);
    };
    addEventListener("touchstart", down, { passive: true });
    addEventListener("touchmove", move, { passive: false });
    addEventListener("touchend", up);
    return () => { removeEventListener("touchstart", down); removeEventListener("touchmove", move); removeEventListener("touchend", up); };
  }, [onRefresh]);

  const p = Math.min(1, pull / TRIGGER);
  const ready = pull >= TRIGGER || busy;
  const ARC = 29; // ~ length of the arc path
  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-40 flex justify-center" style={{ height: pull, transition: dragging ? "none" : "height 380ms var(--ease-out)" }}>
        {pull > 4 && (
          <div className="mt-auto mb-2 grid h-11 w-11 place-items-center rounded-full glass" style={{ opacity: Math.min(1, pull / 30) }}>
            <svg width="26" height="26" viewBox="0 0 32 32" style={{ animation: busy ? "spin 1s linear infinite" : undefined, transformOrigin: "50% 60%" }} aria-hidden>
              <path d="M7 22a9 9 0 0 1 18 0" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeDasharray={ARC} strokeDashoffset={ARC * (1 - p)} />
              {ready && <circle cx="16" cy="22" r="2.6" fill="var(--img-bg)" style={{ animation: "dotDrop 420ms var(--spring) both" }} />}
            </svg>
          </div>
        )}
      </div>
      <div style={{ transform: `translateY(${pull}px)`, transition: dragging ? "none" : "transform 380ms var(--ease-out)" }}>{children}</div>
    </div>
  );
}
