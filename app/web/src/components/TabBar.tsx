"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";
import { Home, Search, Briefcase, Plus } from "./icons";
import { navKey } from "./shell/routes";

// Floating glass bar. A light-blue liquid-glass pill glides to the active tab and stretches like liquid on the way.
type Box = { left: number; width: number };

export function TabBar({ me }: { me?: string | null }) {
  const path = usePathname();
  const key = navKey(path);
  const refs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const prev = useRef<Box | null>(null);
  const [pill, setPill] = useState<(Box & { ms: number; squash: boolean }) | null>(null);

  useLayoutEffect(() => {
    const el = key ? refs.current[key] : null;
    if (!el) { prev.current = null; setPill(null); return; }
    const to = { left: el.offsetLeft, width: el.offsetWidth };
    const from = prev.current;
    prev.current = to;
    if (!from) { setPill({ ...to, ms: 0, squash: false }); return; }
    // stretch across both tabs (a little squashed, like a drop being pulled), then spring onto the new one
    const left = Math.min(from.left, to.left), right = Math.max(from.left + from.width, to.left + to.width);
    setPill({ left, width: right - left, ms: 200, squash: true });
    const t = setTimeout(() => setPill({ ...to, ms: 520, squash: false }), 200);
    return () => clearTimeout(t);
  }, [key]);

  const item = (k: string, href: string, label: string, icon: React.ReactNode) => (
    <Link ref={(el) => { refs.current[k] = el; }} href={href} aria-label={label} aria-current={key === k ? "page" : undefined}
      className={`press relative z-10 grid h-[54px] w-[60px] place-items-center transition-colors duration-300 ${key === k ? "text-[#0b1a29]" : "text-muted hover:text-fg"}`}>
      {icon}
    </Link>
  );
  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center pb-[max(14px,env(safe-area-inset-bottom))] pt-8 [background:linear-gradient(to_top,var(--bg)_30%,transparent)] lg:hidden">
      <div className="glass pointer-events-auto relative flex items-center gap-1.5 rounded-full p-2 shadow-[0_12px_40px_-12px_rgba(15,40,70,0.35)]">
        {pill && (
          <span aria-hidden className="tab-liquid absolute top-2 h-[54px] rounded-full"
            style={{ left: pill.left, width: pill.width, transform: pill.squash ? "scaleY(.86)" : "none",
              transition: pill.ms ? `left ${pill.ms}ms var(--ease-out), width ${pill.ms}ms ${pill.ms > 300 ? "var(--spring)" : "var(--ease-out)"}, transform ${pill.ms}ms var(--spring)` : "none" }} />
        )}
        {item("home", "/social", "Home", <Home size={25} />)}
        {item("search", "/search", "Search", <Search size={25} />)}
        <Link href="/create" className="press relative z-10 mx-1 flex h-[54px] items-center gap-2 whitespace-nowrap rounded-full bg-pill px-5 text-[16px] font-medium tracking-[-0.01em] text-pill-fg">
          <Plus size={19} /> Create
        </Link>
        {item("jobs", "/jobs", "Jobs", <Briefcase size={25} />)}
        <Link ref={(el) => { refs.current.me = el; }} href="/u/me" aria-label="Profile" className="press relative z-10 grid h-[54px] w-[60px] place-items-center">
          {me ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={me} alt="" className={`h-[34px] w-[34px] rounded-[11px] object-cover ring-2 transition-shadow ${key === "me" ? "ring-[#0b1a29]" : "ring-line-strong"}`} />
          ) : <span className={`h-[34px] w-[34px] rounded-[11px] bg-[var(--img-bg)] ring-2 ${key === "me" ? "ring-[#0b1a29]" : "ring-line-strong"}`} />}
        </Link>
      </div>
    </nav>
  );
}
