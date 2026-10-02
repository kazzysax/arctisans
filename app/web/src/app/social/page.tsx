import Link from "next/link";
import { Stories } from "@/components/Stories";
import { DiscoverCard } from "@/components/DiscoverCard";
import { FeedPost } from "@/components/FeedPost";
import { TabBar } from "@/components/TabBar";
import { HScroll } from "@/components/HScroll";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Bell } from "@/components/icons";
import { discover, following } from "@/lib/demo";

export const metadata = { title: "Arctisans · Social" };

function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between px-5">
      <h2 className="text-[17px] font-medium tracking-[-0.02em]">{children}</h2>
      {action}
    </div>
  );
}

export default function Social() {
  return (
    <div className="relative mx-auto min-h-dvh max-w-[480px] pb-24">
      {/* top glass panel: header + stories, rounded bottom like the reference */}
      <section className="glass relative z-30 rounded-b-[34px] border-t-0 px-5 pb-5 pt-[max(18px,env(safe-area-inset-top))]">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-faint">Arctisans</div>
            <h1 className="mt-0.5 text-[26px] font-semibold tracking-[-0.035em]">Socials</h1>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/notifications" aria-label="Notifications" className="press relative grid h-10 w-10 place-items-center rounded-full hairline text-muted">
              <Bell size={19} />
              <span className="absolute right-[10px] top-[9px] h-[7px] w-[7px] rounded-full bg-fg ring-2 ring-[var(--bg)]" />
            </Link>
          </div>
        </div>
        <Stories />
      </section>

      <div className="pt-7">
        <SectionTitle action={<div className="flex gap-1.5 text-[12px]"><span className="rounded-full bg-pill px-3 py-1.5 font-medium text-pill-fg">Work</span><Link href="/social?feed=request" className="rounded-full hairline px-3 py-1.5 text-muted">Requests</Link></div>}>Discover</SectionTitle>
        <HScroll className="mt-4 flex snap-x snap-mandatory gap-3 scroll-px-5 px-5">
          {discover.map((p) => <DiscoverCard key={p.id} post={p} />)}
        </HScroll>
      </div>

      <div className="mx-5 mt-8 rule" />

      <div className="pt-7">
        <SectionTitle action={<Link href="/search" className="text-[12px] text-muted">See all</Link>}>From people you follow</SectionTitle>
        <div className="mt-4 flex flex-col gap-4 px-4">
          {following.map((p) => <FeedPost key={p.id} post={p} />)}
        </div>
      </div>

      <TabBar />
    </div>
  );
}
