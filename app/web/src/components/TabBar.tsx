"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, Briefcase, Plus } from "./icons";

// Floating glass bar: two icons, a wide Create pill in the centre, then two more (reference layout).
export function TabBar({ me = "/demo/av_68.jpg" }: { me?: string }) {
  const path = usePathname();
  const item = (href: string, label: string, icon: React.ReactNode) => {
    const on = path === href;
    return (
      <Link href={href} aria-label={label} className={`press relative grid h-11 w-11 place-items-center rounded-full transition-colors ${on ? "text-fg" : "text-faint hover:text-muted"}`}>
        {icon}
        <span className={`absolute bottom-[5px] left-1/2 h-[3px] w-[3px] -translate-x-1/2 rounded-full ${on ? "bg-fg" : "bg-transparent"}`} />
      </Link>
    );
  };
  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center pb-[max(14px,env(safe-area-inset-bottom))] pt-10 [background:linear-gradient(to_top,var(--bg)_30%,transparent)]">
      <div className="glass pointer-events-auto flex items-center gap-1 rounded-full p-1.5">
        {item("/social", "Home", <Home />)}
        {item("/search", "Search", <Search />)}
        <Link href="/create" className="press mx-1.5 flex h-11 items-center gap-1.5 rounded-full bg-pill px-5 text-[14px] font-medium tracking-[-0.01em] text-pill-fg">
          <Plus size={18} /> Create
        </Link>
        {item("/jobs", "Jobs", <Briefcase />)}
        <Link href="/u/me" aria-label="Profile" className="press grid h-11 w-11 place-items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={me} alt="" className={`h-[30px] w-[30px] rounded-[10px] object-cover ring-1 ${path.startsWith("/u/") ? "ring-fg" : "ring-line-strong"}`} />
        </Link>
      </div>
    </nav>
  );
}
