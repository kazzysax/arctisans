"use client";
import { useRef } from "react";
import { LEAF_OUTLINE, LEAF_STEM, LEAF_VEINS } from "../Logo";
/** Double-tap reward: the Arctisans leaf pops in light blue with a ring of sparks. Purely decorative. */
export function LikeBurst({ k }: { k: number }) {
  if (!k) return null;
  return (
    <div key={k} className="pointer-events-none absolute inset-0 z-30 grid place-items-center">
      <div className="relative">
        {Array.from({ length: 8 }, (_, i) => (
          <span key={i} className="absolute left-1/2 top-1/2 -ml-[3px] -mt-[3px] h-[6px] w-[6px] rounded-full bg-[var(--img-bg)]"
            style={{ ["--a" as string]: `${i * 45}deg`, animation: "spark 700ms var(--ease-out) both", animationDelay: "90ms" }} />
        ))}
        <svg width="92" height="92" viewBox="0 0 32 32" style={{ animation: "arcPop 900ms var(--ease-out) both", filter: "drop-shadow(0 6px 18px rgba(80,140,200,.55))" }} aria-hidden>
          <g transform="translate(16 16) scale(.13) translate(0 -2)" stroke="var(--img-bg)" strokeLinecap="round" strokeLinejoin="round">
            <path d={LEAF_OUTLINE} fill="var(--img-bg)" fillOpacity={0.35} strokeWidth="11" />
            <path d={LEAF_VEINS} fill="none" strokeWidth="7" />
            <path d={LEAF_STEM} strokeWidth="13" />
          </g>
        </svg>
      </div>
    </div>
  );
}

/** Single tap -> onTap (after a short wait), double tap -> onDouble. Works for touch and mouse. */
export function useTaps(onTap: () => void, onDouble: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const last = useRef(0);
  return () => {
    const now = Date.now();
    if (now - last.current < 300) { if (timer.current) clearTimeout(timer.current); timer.current = null; last.current = 0; onDouble(); return; }
    last.current = now;
    timer.current = setTimeout(() => { timer.current = null; onTap(); }, 300);
  };
}
