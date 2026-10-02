"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, Briefcase, Plus } from "./icons";

// Floating glass bar at compact size. Each item keeps a 44px invisible touch area (after:) so it stays easy to tap.
const hit = "relative after:absolute after:left-1/2 after:top-1/2 after:h-11 after:w-11 after:-translate-x-1/2 after:-translate-y-1/2 after:content-['']";

export function TabBar({ me = "/demo/av_68.jpg" }: { me?: string }) {
  const path = usePathname();
  const item = (href: string, label: string, icon: React.ReactNode) => {
    const on = path === href;
    return (
      <Link href={href} aria-label={label} className={`press grid h-[22px] w-[26px] place-items-center ${hit} transition-colors ${on ? "text-fg" : "text-faint hover:text-muted"}`}>
        {icon}
      </Link>
    );
  };
  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center pb-[max(12px,env(safe-area-inset-bottom))] pt-6 [background:linear-gradient(to_top,var(--bg)_25%,transparent)]">
      <div className="glass pointer-events-auto flex items-center gap-1.5 rounded-full px-2.5 py-[3px]">
        {item("/social", "Home", <Home size={14} />)}
        {item("/search", "Search", <Search size={14} />)}
        <Link href="/create" className={`press mx-0.5 flex h-[22px] items-center gap-1 rounded-full bg-pill px-2.5 text-[10.5px] font-medium tracking-[-0.01em] text-pill-fg ${hit}`}>
          <Plus size={11} /> Create
        </Link>
        {item("/jobs", "Jobs", <Briefcase size={14} />)}
        <Link href="/u/me" aria-label="Profile" className={`press grid h-[22px] w-[26px] place-items-center ${hit}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={me} alt="" className={`h-[16px] w-[16px] rounded-[5px] object-cover ring-1 ${path.startsWith("/u/") ? "ring-fg" : "ring-line-strong"}`} />
        </Link>
      </div>
    </nav>
  );
}
