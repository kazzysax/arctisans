"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";
import { Home, Search, Briefcase, Plus } from "./icons";
import { navKey } from "./shell/routes";

// Floating glass bar. A soft pill glides to the active tab and stretches like liquid on the way (fluidity).
// Each item keeps a 44px invisible touch area (after:) so the compact bar stays easy to tap.
const hit = "relative after:absolute after:left-1/2 after:top-1/2 after:h-11 after:w-11 after:-translate-x-1/2 after:-translate-y-1/2 after:content-['']";
type Box = { left: number; width: number };

export function TabBar({ me = "/demo/av_49.jpg" }: { me?: string }) {
  const path = usePathname();
  const key = navKey(path);
  const refs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const prev = useRef<Box | null>(null);
  const [pill, setPill] = useState<(Box & { ms: number }) | null>(null);

  useLayoutEffect(() => {
    const el = key ? refs.current[key] : null;
    if (!el) { prev.current = null; setPill(null); return; }
    const to = { left: el.offsetLeft - 5, width: el.offsetWidth + 10 };
    const from = prev.current;
    prev.current = to;
    if (!from) { setPill({ ...to, ms: 0 }); return; }
    // stretch to cover both tabs, then snap onto the new one
    const left = Math.min(from.left, to.left), right = Math.max(from.left + from.width, to.left + to.width);
    setPill({ left, width: right - left, ms: 170 });
    const t = setTimeout(() => setPill({ ...to, ms: 380 }), 170);
    return () => clearTimeout(t);
  }, [key]);

  const item = (k: string, href: string, label: string, icon: React.ReactNode) => (
    <Link ref={(el) => { refs.current[k] = el; }} href={href} aria-label={label} aria-current={key === k ? "page" : undefined}
      className={`press relative z-10 grid h-[22px] w-[26px] place-items-center ${hit} transition-colors duration-300 ${key === k ? "text-fg" : "text-faint hover:text-muted"}`}>
      {icon}
    </Link>
  );
  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center pb-[max(12px,env(safe-area-inset-bottom))] pt-6 [background:linear-gradient(to_top,var(--bg)_25%,transparent)] lg:hidden">
      <div className="glass pointer-events-auto relative flex items-center gap-1.5 rounded-full px-2.5 py-[3px]">
        {pill && (
          <span aria-hidden className="absolute top-[3px] h-[22px] rounded-full bg-fg/[0.12]"
            style={{ left: pill.left, width: pill.width, transition: pill.ms ? `left ${pill.ms}ms var(--ease-out), width ${pill.ms}ms ${pill.ms > 200 ? "var(--spring)" : "var(--ease-out)"}` : "none" }} />
        )}
        {item("home", "/social", "Home", <Home size={14} />)}
        {item("search", "/search", "Search", <Search size={14} />)}
        <Link href="/create" className={`press relative z-10 mx-0.5 flex h-[22px] items-center gap-1 rounded-full bg-pill px-2.5 text-[10.5px] font-medium tracking-[-0.01em] text-pill-fg ${hit}`}>
          <Plus size={11} /> Create
        </Link>
        {item("jobs", "/jobs", "Jobs", <Briefcase size={14} />)}
        <Link ref={(el) => { refs.current.me = el; }} href="/u/me" aria-label="Profile" className={`press relative z-10 grid h-[22px] w-[26px] place-items-center ${hit}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={me} alt="" className={`h-[16px] w-[16px] rounded-[5px] object-cover ring-1 transition-shadow ${key === "me" ? "ring-fg" : "ring-line-strong"}`} />
        </Link>
      </div>
    </nav>
  );
}
