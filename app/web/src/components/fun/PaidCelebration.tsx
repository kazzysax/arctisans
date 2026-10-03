"use client";
import { useMemo } from "react";
import { Mark } from "../Logo";

// "You got paid!" moment: light-blue screen, confetti, the leaf tile, the amount, then Send kudos / Share.
const COLORS = ["#F4B9A6", "#F2D27C", "#9FD8B8", "#B9A8F0", "#8EC1EA", "#F3B3C6"];

export function PaidCelebration({ amount, from, title, onKudos, onClose }:
  { amount: string; from: string; title: string; onKudos: () => void; onClose: () => void }) {
  const bits = useMemo(() => Array.from({ length: 34 }, (_, i) => ({
    left: (i * 37) % 100, delay: (i % 9) * 0.12, dur: 2.6 + (i % 5) * 0.35, c: COLORS[i % COLORS.length],
    w: i % 3 ? 10 : 7, h: i % 3 ? 5 : 7, round: i % 3 === 0, dx: `${((i * 53) % 80) - 40}px`, r: `${(i * 97) % 720}deg`,
  })), []);
  async function share() {
    const text = `Just got paid ${amount} on Arctisans for "${title}" 🍃`;
    if (navigator.share) await navigator.share({ text, url: location.origin }).catch(() => null);
    else await navigator.clipboard.writeText(text).catch(() => null);
  }
  return (
    <div className="fixed inset-0 z-[60] overflow-hidden bg-[var(--img-bg)] text-[#0b1a29]" style={{ animation: "fade 260ms both" }}>
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {bits.map((b, i) => (
          <span key={i} className="absolute top-0" style={{ left: `${b.left}%`, width: b.w, height: b.h, background: b.c, borderRadius: b.round ? 99 : 2,
            ["--dx" as string]: b.dx, ["--r" as string]: b.r, animation: `confetti ${b.dur}s cubic-bezier(.3,.6,.5,1) ${b.delay}s both` }} />
        ))}
      </div>
      <div className="relative mx-auto flex min-h-dvh max-w-[480px] flex-col items-center px-6 pb-[max(28px,env(safe-area-inset-bottom))] pt-[12vh] text-center">
        <div className="grid h-[168px] w-[168px] place-items-center rounded-[36%] bg-white shadow-[0_24px_50px_-20px_rgba(15,34,54,0.45)]" style={{ animation: "paidIn 800ms var(--spring) both" }}>
          <Mark size={128} className="text-[#0b1a29]" />
        </div>
        <div className="rise mt-9 text-[11.5px] uppercase tracking-[0.22em] opacity-60" style={{ animationDelay: "250ms" }}>Job complete</div>
        <h1 className="rise mt-2 text-[32px] font-bold tracking-[-0.035em]" style={{ animationDelay: "320ms" }}>You got paid! 🎉</h1>
        <div className="rise mt-2 font-serif text-[58px] leading-none" style={{ animationDelay: "420ms" }}>{amount}<span className="ml-1.5 text-[22px] opacity-60">USDC</span></div>
        <p className="rise mt-3 text-[14px] opacity-70" style={{ animationDelay: "500ms" }}>from {from} · {title}</p>
        <div className="flex-1" />
        <div className="rise flex w-full gap-2.5" style={{ animationDelay: "650ms" }}>
          <button onClick={onKudos} className="press h-[54px] flex-1 rounded-full bg-white text-[15px] font-semibold">Send kudos 🍃</button>
          <button onClick={share} className="press h-[54px] flex-1 rounded-full bg-black text-[15px] font-semibold text-white">Share</button>
        </div>
        <button onClick={onClose} className="mt-3 h-11 text-[14px] opacity-60">Close</button>
      </div>
    </div>
  );
}
