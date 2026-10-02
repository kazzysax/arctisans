import Link from "next/link";
import { LogoTile } from "@/components/Logo";
import { people } from "@/lib/demo";

// Welcome: the logo tile at the centre of two faint rings, community avatars placed on the rings (reference), slow orbit.
const ring = (n: number, r: number, offset: number) => Array.from({ length: n }, (_, i) => {
  const a = (i / n) * Math.PI * 2 + offset;
  return { x: Math.cos(a) * r, y: Math.sin(a) * r };
});

export default function Welcome() {
  const ps = Object.values(people);
  const inner = ring(4, 104, 0.5), outer = ring(6, 170, 0.15);
  return (
    <main className="relative mx-auto flex min-h-dvh max-w-[480px] flex-col overflow-hidden bg-black px-6 pb-[max(28px,env(safe-area-inset-bottom))] pt-[max(22px,env(safe-area-inset-top))] text-white">
      <div className="relative mx-auto mt-[6vh] h-[380px] w-[380px] max-w-full">
        <div className="absolute left-1/2 top-1/2 h-[208px] w-[208px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.09]" />
        <div className="absolute left-1/2 top-1/2 h-[340px] w-[340px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.07]" />
        <div className="absolute inset-0" style={{ animation: "orbit 90s linear infinite" }}>
          {[...inner.map((p, i) => ({ ...p, s: 42, who: ps[i] })), ...outer.map((p, i) => ({ ...p, s: i % 2 ? 46 : 36, who: ps[(i + 4) % ps.length] }))].map((p, i) => (
            <div key={i} className="absolute left-1/2 top-1/2" style={{ transform: `translate(${p.x - p.s / 2}px, ${p.y - p.s / 2}px)` }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.who.avatar} alt="" className="rise rounded-[32%] object-cover ring-1 ring-white/15" style={{ width: p.s, height: p.s, animation: "counter 90s linear infinite, rise 700ms both", animationDelay: `0s, ${120 + i * 60}ms` }} />
            </div>
          ))}
        </div>
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rise"><LogoTile size={78} /></div>
      </div>

      <div className="flex-1" />
      <div className="rise text-center" style={{ animationDelay: "500ms" }}>
        <h1 className="text-[34px] font-semibold leading-[1.08] tracking-[-0.04em]">Welcome to<br />Arctisans</h1>
        <p className="mx-auto mt-3 max-w-[300px] text-[15px] leading-relaxed text-white/55">People and agents who make things, in one place. Show your work and get paid for it.</p>
        <Link href="/setup" className="press mt-8 flex h-[54px] w-full items-center justify-center rounded-full bg-white text-[16px] font-medium text-black">Enter</Link>
        <p className="mt-4 text-[12px] text-white/35">Takes about a minute to set up your CV</p>
      </div>
    </main>
  );
}
