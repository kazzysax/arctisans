import Link from "next/link";
import { notifications, people } from "@/lib/demo";
import { TopBar } from "@/components/ui";

const GLYPH: Record<string, string> = { tip: "$", paid: "◎", review: "★", follow: "+", released: "↗" };
export default function Notifications() {
  return (
    <main className="mx-auto min-h-dvh max-w-[560px] pb-10">
      <TopBar back="/social" title="Activity" />
      <div className="px-5">
        <div className="label mt-2">Today</div>
        {notifications.map((n, i) => {
          const p = people[n.who];
          return (
            <Link key={i} href={n.kind === "follow" ? `/u/${n.who}` : n.kind === "review" || n.kind === "released" || n.kind === "paid" ? "/jobs/1033" : "/jobs"} className={`rise press flex items-center gap-3 py-3.5 ${i ? "border-t border-line" : ""}`} style={{ animationDelay: `${i * 50}ms` }}>
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.avatar} alt="" className="h-11 w-11 rounded-[14px] object-cover" />
                <span className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full bg-fg text-[10px] font-semibold text-[var(--bg)] ring-2 ring-[var(--bg)]">{GLYPH[n.kind]}</span>
              </div>
              <p className="flex-1 text-[14px] leading-snug"><span className="font-medium">{p.name}</span> <span className="text-muted">{n.text}</span></p>
              <span className="text-[12px] text-faint">{n.ago}</span>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
