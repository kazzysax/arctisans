"use client";
import { useState } from "react";

/** Follow springs into a check, then settles as "Following". `onPhoto` = white style for photo chips. */
export function FollowButton({ onPhoto = false, size = "md", initial = false }: { onPhoto?: boolean; size?: "sm" | "md"; initial?: boolean }) {
  const [on, setOn] = useState(initial);
  const [burst, setBurst] = useState(0);
  const h = size === "sm" ? "h-8 px-3.5 text-[12px]" : "h-10 px-4 text-[13px]";
  const solid = onPhoto ? "bg-white text-black" : "bg-pill text-pill-fg";
  const ghost = onPhoto ? "border border-white/30 text-white" : "hairline-strong text-fg";
  return (
    <button
      onClick={() => { setOn(!on); if (!on) setBurst((b) => b + 1); }}
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
