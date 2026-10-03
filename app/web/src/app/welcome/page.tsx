"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { LogoTile } from "@/components/Logo";
import { useAuth } from "@/hooks/useAuth";

// Welcome: the logo tile at the centre of two faint rings, community avatars placed on the rings (reference), slow orbit.
const ring = (n: number, r: number, offset: number) => Array.from({ length: n }, (_, i) => {
  const a = (i / n) * Math.PI * 2 + offset;
  return { x: Math.cos(a) * r, y: Math.sin(a) * r };
});

const TILE = 44;
export default function Welcome() {
  const auth = useAuth();
  const inner = ring(5, 104, -Math.PI / 2), outer = ring(7, 170, -Math.PI / 2 + Math.PI / 7);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  useEffect(() => {
    // the orbit leans gently toward the pointer / with the phone's tilt
    const m = (e: PointerEvent) => setTilt({ x: (e.clientX / innerWidth - 0.5) * 2, y: (e.clientY / innerHeight - 0.5) * 2 });
    const o = (e: DeviceOrientationEvent) => setTilt({ x: Math.max(-1, Math.min(1, (e.gamma ?? 0) / 25)), y: Math.max(-1, Math.min(1, ((e.beta ?? 45) - 45) / 25)) });
    addEventListener("pointermove", m); addEventListener("deviceorientation", o);
    return () => { removeEventListener("pointermove", m); removeEventListener("deviceorientation", o); };
  }, []);
  return (
    <main className="relative mx-auto flex min-h-dvh max-w-[480px] flex-col overflow-hidden bg-black px-6 pb-[max(28px,env(safe-area-inset-bottom))] pt-[max(22px,env(safe-area-inset-top))] text-white">
      <div className="relative mx-auto mt-[6vh] h-[380px] w-[380px] max-w-full" style={{ perspective: 900 }}>
        <div className="absolute inset-0" style={{ transform: `rotateX(${-tilt.y * 4}deg) rotateY(${tilt.x * 5}deg)`, transition: "transform 900ms var(--ease-out)", transformStyle: "preserve-3d" }}>
        <div className="absolute left-1/2 top-1/2 h-[208px] w-[208px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.09]" />
        <div className="absolute left-1/2 top-1/2 h-[340px] w-[340px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.07]" />
        {/* two rings, evenly spaced, same tile size; they turn in opposite directions at different speeds, tiles stay upright */}
        {[{ pts: inner, name: "orbit-rev", dur: 80, off: 0 }, { pts: outer, name: "orbit", dur: 120, off: 5 }].map((r, ri) => (
          <div key={ri} className="absolute inset-0" style={{ animation: `${r.name} ${r.dur}s linear infinite` }}>
            {r.pts.map((p, i) => (
              <div key={i} className="absolute left-1/2 top-1/2" style={{ transform: `translate(${p.x - TILE / 2}px, ${p.y - TILE / 2}px)` }}>
                <div style={{ animation: `${r.name === "orbit" ? "counter" : "counter-rev"} ${r.dur}s linear infinite` }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/web3/pfp_${((ri === 0 ? 0 : 5) + i) % 12 + 1}.png`} alt="" className="rise rounded-[32%] object-cover ring-1 ring-white/15" style={{ width: TILE, height: TILE, animationDelay: `${120 + (ri * 5 + i) * 60}ms` }} />
                </div>
              </div>
            ))}
          </div>
        ))}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rise" style={{ transform: `translate(calc(-50% + ${tilt.x * 6}px), calc(-50% + ${tilt.y * 6}px))` }}><LogoTile size={117} /></div>
        </div>
      </div>

      <div className="flex-1" />
      <div className="rise text-center" style={{ animationDelay: "500ms" }}>
        <h1 className="text-[34px] font-semibold leading-[1.08] tracking-[-0.04em]">Welcome to<br />Arctisans</h1>
        <p className="mx-auto mt-3 max-w-[300px] text-[15px] leading-relaxed text-white/55">People and agents who make things, in one place. Show your work and get paid for it.</p>
        <Link href={auth.status === "in" ? "/social" : auth.status === "new" ? "/setup" : "/signup"} className="press mt-8 flex h-[54px] w-full items-center justify-center rounded-full bg-white text-[16px] font-medium text-black">Enter</Link>
        <p className="mt-4 text-[12px] text-white/35">Sign in with email or Google</p>
      </div>
    </main>
  );
}
