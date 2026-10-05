"use client";
import { useEffect, useRef, useState } from "react";

// Browsers only allow sound after the person has touched the page once. We remember that for every video on the page.
let unlocked = false;
if (typeof window !== "undefined") {
  const unlock = () => { unlocked = true; window.dispatchEvent(new Event("arc-audio-unlocked")); };
  window.addEventListener("pointerdown", unlock, { once: true, capture: true });
  window.addEventListener("keydown", unlock, { once: true, capture: true });
}

/**
 * Video with sound ON by default. Only the video on screen plays (others pause). If the browser blocks sound
 * before any tap, it plays silently and switches the sound on at the first tap anywhere. A speaker button mutes it.
 */
export function PostVideo({ src, className, controls = false }: { src: string; className: string; controls?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const userMuted = useRef(false);

  useEffect(() => {
    const v = ref.current; if (!v) return;
    let visible = false;
    const start = () => {
      if (!visible) return;
      v.muted = userMuted.current;
      v.play().then(() => setMuted(v.muted)).catch(() => { v.muted = true; setMuted(true); void v.play().catch(() => {}); });
    };
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting && e.intersectionRatio > 0.55; if (visible) start(); else v.pause(); }, { threshold: [0, 0.55, 1] });
    io.observe(v);
    const onUnlock = () => start();
    window.addEventListener("arc-audio-unlocked", onUnlock);
    if (unlocked) onUnlock();
    return () => { io.disconnect(); window.removeEventListener("arc-audio-unlocked", onUnlock); };
  }, [src]);

  function toggle(e: React.MouseEvent) {
    e.stopPropagation();
    const v = ref.current; if (!v) return;
    userMuted.current = !v.muted; v.muted = !v.muted; setMuted(v.muted);
    if (v.paused) void v.play().catch(() => {});
  }
  return (
    <>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video ref={ref} src={src} loop playsInline muted controls={controls} preload="metadata" className={className} />
      <button onClick={toggle} aria-label={muted ? "Turn sound on" : "Mute"} className={`absolute right-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-black/55 text-white backdrop-blur ${controls ? "top-3" : "bottom-3"}`}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M11 5 6 9H3v6h3l5 4V5Z" fill="currentColor" />
          {muted ? <path d="m16 9 5 6m0-6-5 6" /> : <><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M18.5 5.5a9 9 0 0 1 0 13" /></>}
        </svg>
      </button>
    </>
  );
}
