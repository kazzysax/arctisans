"use client";
import { useEffect, useRef, useState } from "react";

// Browsers only allow sound after the person has touched the page once. We remember that for every video on the page.
let unlocked = false;
if (typeof window !== "undefined") {
  const unlock = () => { unlocked = true; window.dispatchEvent(new Event("arc-audio-unlocked")); };
  window.addEventListener("pointerdown", unlock, { once: true, capture: true });
  window.addEventListener("keydown", unlock, { once: true, capture: true });
}

// ONE video plays at a time, page-wide. Each player reports how much of it is on screen; the most visible one wins.
// A video the person started themselves (tap/controls) stays the one that plays until they scroll it away or start another.
type Slot = { ratio: number; play: () => void; pause: () => void; stopped: boolean; autoPlay: boolean; autoPause: boolean; refresh: () => void };
const slots = new Set<Slot>();
let pinned: Slot | null = null;
function elect() {
  let best: Slot | null = null;
  for (const s of slots) s.refresh(); // pick up the sound setting if the person just tapped the page
  if (pinned && slots.has(pinned) && pinned.ratio >= 0.3) best = pinned;
  else { pinned = null; for (const s of slots) if (!s.stopped && s.ratio >= 0.55 && (!best || s.ratio > best.ratio)) best = s; }
  for (const s of slots) if (s !== best) s.pause();
  best?.play();
}

/**
 * Video with sound ON by default (once the browser allows it). Only one video plays at a time. Tapping the speaker mutes/unmutes.
 */
export function PostVideo({ src, className, controls = false }: { src: string; className: string; controls?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const userMuted = useRef(false);

  useEffect(() => {
    const v = ref.current; if (!v) return;
    const slot: Slot = {
      ratio: 0, stopped: false, autoPlay: false, autoPause: false,
      // a video that started silently (browser blocked sound) gets its sound once the person has touched the page
      refresh: () => { if (unlocked && !v.paused && v.muted && !userMuted.current) v.muted = false; },
      pause: () => { if (!v.paused) { slot.autoPause = true; v.pause(); } },
      play: () => {
        if (!v.paused) return;
        v.muted = userMuted.current; slot.autoPlay = true; // our own start, not the person's
        v.play().catch(() => { v.muted = true; void v.play().catch(() => { slot.autoPlay = false; }); });
      },
    };
    slots.add(slot);
    const io = new IntersectionObserver(([e]) => { slot.ratio = e.isIntersecting ? e.intersectionRatio : 0; if (slot.ratio === 0) slot.stopped = false; elect(); }, { threshold: [0, 0.3, 0.55, 0.8, 1] });
    io.observe(v);
    const onVol = () => setMuted(v.muted);
    // the person pressed play on this one (controls, tap): it becomes the one that plays, others stop
    const onPlay = () => { if (slot.autoPlay) { slot.autoPlay = false; return; } slot.stopped = false; pinned = slot; elect(); };
    const onPause = () => { if (slot.autoPause) { slot.autoPause = false; return; } slot.stopped = true; if (pinned === slot) pinned = null; };
    v.addEventListener("volumechange", onVol); v.addEventListener("play", onPlay); v.addEventListener("pause", onPause);
    const onUnlock = () => { elect(); slot.refresh(); };
    window.addEventListener("arc-audio-unlocked", onUnlock);
    if (unlocked) onUnlock();
    return () => { io.disconnect(); slots.delete(slot); if (pinned === slot) pinned = null; v.removeEventListener("volumechange", onVol); v.removeEventListener("play", onPlay); v.removeEventListener("pause", onPause); window.removeEventListener("arc-audio-unlocked", onUnlock); };
  }, [src]);

  function toggle(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation(); // the button sits inside tappable cards: never open the post
    const v = ref.current; if (!v) return;
    userMuted.current = !v.muted; v.muted = userMuted.current; setMuted(v.muted);
    if (v.paused) void v.play().catch(() => {});
  }
  return (
    <>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video ref={ref} src={src} loop playsInline muted controls={controls} preload="metadata" className={className} />
      <button type="button" onClick={toggle} onPointerDown={(e) => e.stopPropagation()} aria-label={muted ? "Turn sound on" : "Mute"} className={`absolute right-3 z-30 grid h-10 w-10 place-items-center rounded-full bg-black/60 text-white backdrop-blur ${controls ? "top-3" : "bottom-3"}`}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M11 5 6 9H3v6h3l5 4V5Z" fill="currentColor" />
          {muted ? <path d="m16 9 5 6m0-6-5 6" /> : <><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M18.5 5.5a9 9 0 0 1 0 13" /></>}
        </svg>
      </button>
    </>
  );
}
