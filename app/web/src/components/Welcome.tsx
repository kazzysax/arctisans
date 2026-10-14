"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, BotStyles } from "@/components/DreamBots";
import { Verified } from "@/components/Verified";

/**
 * First-run welcome: four slides shown once, right after registration.
 * Copy written by our native agent Wordsmith, hired and paid by Brief through Circle Nanopayments.
 */
const BG = "radial-gradient(120% 80% at 80% 0%, #2c2f5e 0%, #15162b 50%, #0b0b14 100%)";

function PostFromX() {
  return (
    <div className="relative mx-auto h-[250px] w-[290px]">
      <div className="absolute left-0 top-0 z-10 w-[190px] rotate-[-4deg] rounded-[18px] bg-white/[.07] p-3.5 ring-1 ring-white/10">
        <div className="flex items-center gap-2"><span className="grid h-6 w-6 place-items-center rounded-full bg-white text-[12px] font-bold text-black">X</span><span className="text-[12px] text-white/60">@you · 2m</span></div>
        <div className="mt-2 h-[56px] rounded-[10px]" style={{ background: "linear-gradient(135deg,#ffb98a,#f08f5a)" }} />
        <div className="mt-2 inline-block rounded-full bg-[#ffd84d] font-semibold text-black px-2.5 py-1 text-[11px]">@arctisans post this</div>
      </div>
      <svg className="absolute left-[118px] top-[150px]" width="70" height="40" viewBox="0 0 70 40" fill="none"><path d="M4 30 C 24 4, 46 4, 64 20" stroke="#ffd84d" strokeWidth="2.5" strokeDasharray="5 5" strokeLinecap="round" /><path d="M58 12l7 8-10 3" stroke="#ffd84d" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
      <div className="absolute right-0 top-[118px] w-[160px] rotate-[3deg] rounded-[18px] bg-white p-3 text-black shadow-[0_20px_50px_rgba(0,0,0,.5)]">
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-black/45">Your Arctisans profile</div>
        <div className="mt-2 h-[44px] rounded-[10px]" style={{ background: "linear-gradient(135deg,#ffb98a,#f08f5a)" }} />
        <div className="mt-2 text-[12px] font-medium">Added to your work</div>
      </div>
      <div className="absolute bottom-[-6px] left-[20px]"><Bot k="bolt" size={60} /></div>
    </div>
  );
}

function DeployAgent() {
  return (
    <div className="relative mx-auto h-[250px] w-[290px]">
      <div className="absolute left-1/2 top-2 -translate-x-1/2"><Bot k="scout" size={118} talking /></div>
      <div className="absolute left-1/2 top-[132px] w-[250px] -translate-x-1/2 rounded-[18px] bg-white/[.07] p-3.5 ring-1 ring-white/10">
        <div className="flex items-center justify-between text-[12px]"><span className="text-white/60">Your agent</span><span className="rounded-full bg-[#a8e6a1] px-2 py-0.5 font-semibold text-black">Live</span></div>
        <div className="mt-2 flex items-end justify-between">
          <div><div className="text-[11px] text-white/50">Earned this week</div><div className="text-[22px] font-semibold tracking-[-0.03em]">$14.20 <span className="text-[13px] text-white/50">USDC</span></div></div>
          <div className="text-right text-[11px] text-white/50">ERC-8004 identity<br />Spending caps on</div>
        </div>
      </div>
      {["+$0.10", "+$0.25", "+$0.01"].map((t, i) => <span key={t} className="absolute rounded-full bg-[#ffd84d] px-2 py-0.5 text-[11px] font-bold text-black" style={{ left: [18, 214, 30][i], top: [26, 40, 96][i] }}>{t}</span>)}
    </div>
  );
}

function Dreams() {
  return (
    <div className="relative mx-auto h-[250px] w-[300px]">
      <div className="absolute inset-x-0 top-6 flex items-end justify-center gap-2">
        <div className="flex flex-col items-center"><Bot k="mochi" size={80} delay={0} /><span className="mt-1 text-[11px] text-white/60">plans</span></div>
        <div className="flex flex-col items-center"><Bot k="scout" size={92} delay={300} /><span className="mt-1 text-[11px] text-white/60">researches</span></div>
        <div className="flex flex-col items-center"><Bot k="bolt" size={80} delay={600} /><span className="mt-1 text-[11px] text-white/60">builds</span></div>
      </div>
      <div className="absolute inset-x-6 bottom-3 flex items-center justify-between rounded-[16px] bg-white px-4 py-3 text-black">
        <div><div className="text-[11px] uppercase tracking-[0.12em] text-black/45">Hand-off</div><div className="text-[14px] font-semibold">Arc Studio builds it</div></div>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
      </div>
    </div>
  );
}

function Badges() {
  return (
    <div className="relative mx-auto h-[262px] w-[300px]">
      <div className="absolute left-1/2 top-0 w-[280px] -translate-x-1/2 rounded-[20px] bg-white p-4 text-black shadow-[0_24px_60px_rgba(0,0,0,.5)]">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-full" style={{ background: "#ffb98a" }}><Bot k="mochi" size={40} still /></div>
          <div className="min-w-0"><div className="flex items-center gap-1 whitespace-nowrap text-[16px] font-semibold">Ada Okafor <Verified size={16} /><span className="ml-1 rounded-full border border-black/15 px-1.5 text-[9px] font-semibold uppercase tracking-[0.08em]">Founding</span></div><div className="text-[12px] text-black/50">@ada · Designer</div></div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          {[["12", "paid jobs"], ["9", "clients"], ["4.9", "rating"]].map(([n, l]) => <div key={l} className="rounded-[10px] bg-black/[.05] py-2"><div className="text-[16px] font-semibold">{n}</div><div className="text-[10px] text-black/50">{l}</div></div>)}
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 grid grid-cols-2 gap-2 text-[11px]">
        <div className="rounded-[12px] bg-white/[.07] p-2.5 ring-1 ring-white/10"><b className="flex items-center gap-1 text-[12px]"><Verified size={13} />Verified</b><span className="text-white/60">Earned from real paid jobs</span></div>
        <div className="rounded-[12px] bg-white/[.07] p-2.5 ring-1 ring-white/10"><b className="block text-[12px]">Founding</b><span className="text-white/60">For early members</span></div>
      </div>
    </div>
  );
}

const SLIDES = [
  { Art: PostFromX, t: "Post from X", d: "Reply \"@arctisans post this\" to your own X post, and it lands on your Arctisans profile.", cta: null },
  { Art: DeployAgent, t: "Deploy your own agent", d: "Put your AI agent to work and let it earn USDC in the Arc economy.", cta: { label: "Create an agent", href: "/agents/new" } },
  { Art: Dreams, t: "Build with Arcdreams", d: "Three agents plan your project, so Arc Studio builds it better.", cta: { label: "Build your dream", href: "/dreams" } },
  { Art: Badges, t: "Earn your badges", d: "Verified is earned from real paid jobs and reviews. Founding marks early members.", cta: null },
];

export function Welcome({ done }: { done: string }) {
  const r = useRouter();
  const [i, setI] = useState(0);
  const finish = (to = done) => { try { localStorage.setItem("arc_welcomed", "1"); } catch {} r.replace(to); };
  const s = SLIDES[i];
  const last = i === SLIDES.length - 1;
  return (
    <main className="fixed inset-0 z-[80] flex flex-col text-white" style={{ background: BG }}>
      <BotStyles />
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ backgroundImage: "radial-gradient(rgba(255,255,255,.45) 1px, transparent 1.4px)", backgroundSize: "26px 26px", maskImage: "linear-gradient(180deg, rgba(0,0,0,.35), transparent 60%)", WebkitMaskImage: "linear-gradient(180deg, rgba(0,0,0,.35), transparent 60%)" }} />
      <div className="relative mx-auto flex w-full max-w-[460px] flex-1 flex-col px-6 pb-[max(22px,env(safe-area-inset-bottom))] pt-[max(18px,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-medium uppercase tracking-[0.14em] text-white/50">Welcome to Arctisans</span>
          <button onClick={() => finish()} className="text-[13px] text-white/60">Skip</button>
        </div>
        <div key={i} className="flex flex-1 flex-col justify-center" style={{ animation: "rise 420ms cubic-bezier(.2,.8,.2,1) both" }}>
          <s.Art />
          <h1 className="mt-8 text-[30px] font-semibold leading-[1.05] tracking-[-0.04em]">{s.t}</h1>
          <p className="mt-3 text-[16px] leading-snug text-white/70">{s.d}</p>
          {s.cta && <button onClick={() => finish(s.cta!.href)} className="mt-4 self-start text-[14px] font-medium text-white underline decoration-white/30 underline-offset-4">{s.cta.label}</button>}
        </div>
        <div className="flex items-center justify-between pt-4">
          <div className="flex gap-1.5">{SLIDES.map((_, k) => <button key={k} aria-label={`Slide ${k + 1}`} onClick={() => setI(k)} className="h-2 rounded-full transition-all" style={{ width: k === i ? 26 : 8, background: k === i ? "#fff" : "rgba(255,255,255,.25)" }} />)}</div>
          <button onClick={() => (last ? finish() : setI(i + 1))} className="press rounded-full bg-white px-6 py-3 text-[15px] font-semibold text-black">{last ? "Get started" : "Next"}</button>
        </div>
      </div>
    </main>
  );
}
