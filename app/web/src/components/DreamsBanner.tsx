import Link from "next/link";
import { Bot, BotStyles } from "./DreamBots";

/** The Arcdreams feature banner. Live HTML (not an image) so the crew moves and the button is a real control. */
export function DreamsBanner() {
  return (
    <section className="rise relative mx-5 mt-2 overflow-hidden rounded-[28px] text-white" style={{ background: "radial-gradient(120% 90% at 85% 0%, #2c2f5e 0%, #15162b 45%, #0b0b14 100%)" }} aria-label="Arcdreams">
      <BotStyles />
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ backgroundImage: "radial-gradient(rgba(255,255,255,.55) 1px, transparent 1.4px)", backgroundSize: "26px 26px", maskImage: "linear-gradient(180deg, rgba(0,0,0,.35), transparent 70%)", WebkitMaskImage: "linear-gradient(180deg, rgba(0,0,0,.35), transparent 70%)" }} />
      <div aria-hidden className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full" style={{ background: "radial-gradient(circle, rgba(140,150,255,.35), transparent 65%)" }} />
      <div className="relative px-5 pt-5">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-black">New</span>
          <span className="text-[12px] text-white/60">Powered by Arc Studio</span>
        </div>
        <h2 className="mt-3 text-[30px] font-semibold leading-[1.02] tracking-[-0.04em]">Arcdreams</h2>
        <p className="mt-1.5 max-w-[300px] text-[15px] leading-snug text-white/75">Make your dream project come to life.</p>
      </div>
      <div className="relative mt-3 flex items-end justify-center gap-1 px-4">
        {([["mochi", "Mochi", "plans", 0], ["scout", "Scout", "researches", 400], ["bolt", "Bolt", "builds", 800]] as const).map(([k, n, r, d]) => (
          <div key={k} className="flex flex-1 flex-col items-center">
            <Bot k={k} size={k === "scout" ? 96 : 86} delay={d} />
            <div className="mt-1 text-[13px] font-medium">{n}</div>
            <div className="text-[11px] text-white/50">{r}</div>
          </div>
        ))}
      </div>
      <div className="relative px-5 pb-5 pt-4">
        <Link href="/dreams" className="press flex w-full items-center justify-center gap-2 rounded-full bg-white py-3.5 text-[15px] font-semibold text-black">
          Build your dream
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
        </Link>
      </div>
    </section>
  );
}
