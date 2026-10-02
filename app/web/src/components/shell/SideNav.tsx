"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Mark } from "../Logo";
import { Home, Search, Briefcase, Bell, Plus } from "../icons";
import { ThemeToggle } from "../ThemeToggle";
import { navKey } from "./routes";
import { Roll } from "../fun/Roll";

const Gear = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>;
const Bot = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="8" width="16" height="11" rx="3.5" /><path d="M12 4.5V8M9 13.5h.01M15 13.5h.01M9.5 16.5h5" /></svg>;

// Laptop: a calm left rail. Same destinations as the phone tab bar, plus Activity, Agents and Settings.
export function SideNav() {
  const k = navKey(usePathname());
  const row = (key: string, href: string, label: string, icon: React.ReactNode, extra?: React.ReactNode) => (
    <Link href={href} aria-current={k === key ? "page" : undefined}
      className={`press group relative flex h-11 items-center gap-3.5 rounded-full px-4 text-[15px] transition-colors ${k === key ? "bg-fg/[0.08] font-medium text-fg" : "text-muted hover:bg-fg/[0.04] hover:text-fg"}`}>
      <span className="grid w-5 place-items-center">{icon}</span>{label}{extra}
    </Link>
  );
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col border-r border-line px-4 pb-6 pt-7 lg:flex">
      <Link href="/social" className="mb-8 flex items-center gap-2.5 px-4"><Mark size={26} /><span className="font-serif text-[19px] uppercase tracking-[0.2em]">Arctisans</span></Link>
      <nav className="flex flex-col gap-1">
        {row("home", "/social", "Home", <Home size={20} />)}
        {row("search", "/search", "Search", <Search size={20} />)}
        {row("jobs", "/jobs", "Jobs", <Briefcase size={20} />, <span className="ml-auto text-[12px] text-faint">3</span>)}
        {row("activity", "/notifications", "Activity", <Bell size={20} />, <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[var(--img-bg)]" />)}
        {row("agents", "/agents", "Agents", <Bot />)}
        {row("settings", "/settings", "Settings", <Gear />)}
      </nav>
      <Link href="/create" className="btn btn-solid mt-6 w-full"><Plus size={16} /> Create</Link>
      <div className="flex-1" />
      <Link href="/jobs" className="press mb-3 block rounded-[20px] hairline p-4">
        <div className="text-[10.5px] uppercase tracking-[0.18em] text-faint">Wallet · USDC</div>
        <div className="mt-1 text-[22px] font-semibold"><Roll value={1284.5} prefix="$" decimals={2} /></div>
      </Link>
      <div className="flex items-center gap-3 px-1">
        <Link href="/u/me" className="flex min-w-0 flex-1 items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/demo/av_49.jpg" alt="" className="h-10 w-10 rounded-[13px] object-cover" />
          <div className="min-w-0 leading-tight"><div className="truncate text-[14px] font-medium">Amara Okafor</div><div className="text-[12px] text-faint">@amara · Pro</div></div>
        </Link>
        <ThemeToggle />
      </div>
    </aside>
  );
}
