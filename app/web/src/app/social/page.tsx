"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { DiscoverCard } from "@/components/DiscoverCard";
import { FeedPost } from "@/components/FeedPost";
import { HScroll } from "@/components/HScroll";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Bell } from "@/components/icons";
import { PullToRefresh } from "@/components/fun/PullToRefresh";
import { CraftArt } from "@/components/CraftArt";
import { CRAFTS } from "@/lib/crafts";


type FeedItem = {
  id: string;
  handle: string;
  displayName: string;
  kind: string;
  verified: boolean;
  body: string;
  images: string[];
  skill: string | null;
  likes: number;
  createdAt: number;
};

function ago(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

function toPost(item: FeedItem) {
  return {
    id: item.id,
    by: item.handle,
    photos: item.images,
    caption: item.body,
    skill: item.skill ?? "",
    likes: item.likes,
    tips: 0,
    ago: ago(item.createdAt),
  };
}

function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between px-5">
      <h2 className="text-[17px] font-medium tracking-[-0.02em]">{children}</h2>
      {action}
    </div>
  );
}

function Skeleton({ count = 4, horizontal = false }: { count?: number; horizontal?: boolean }) {
  return (
    <div className={horizontal ? "flex gap-3 overflow-hidden px-5" : "flex flex-col gap-4 px-4"}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`animate-pulse rounded-[22px] bg-line ${horizontal ? "h-[220px] w-[220px] shrink-0" : "h-[120px]"}`} />
      ))}
    </div>
  );
}

export default function Social() {
  const [discover, setDiscover] = useState<FeedItem[] | null>(null);
  const [following, setFollowing] = useState<FeedItem[] | null>(null);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    fetch("/api/posts?feed=work&limit=8", { credentials: "include" })
      .then((r) => r.json())
      .then((j: { items?: FeedItem[] }) => setDiscover(j.items ?? []))
      .catch(() => setDiscover([]));

    fetch("/api/posts?feed=work&following=1&limit=10", { credentials: "include" })
      .then((r) => r.json())
      .then((j: { items?: FeedItem[] }) => setFollowing(j.items ?? []))
      .catch(() => setFollowing([]));

    fetch("/api/notifications", { credentials: "include" })
      .then((r) => r.ok ? r.json() : null)
      .then((j: { unread?: number } | null) => j && setUnread(j.unread ?? 0))
      .catch(() => null);
  }, []);

  return (
    <PullToRefresh>
      <div className="relative mx-auto min-h-dvh max-w-[560px] pb-24">
        {/* top glass panel */}
        <section className="relative z-30 rounded-b-[34px] bg-[var(--img-bg)] px-5 pb-5 pt-[max(18px,env(safe-area-inset-top))] text-[#0b1a29] shadow-[0_18px_40px_-24px_rgba(40,90,140,0.45)]">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-[0.22em] text-[#0b1a29]/55">Arctisans</div>
              <h1 className="mt-0.5 text-[26px] font-semibold tracking-[-0.035em]">Socials</h1>
            </div>
            <div className="flex items-center gap-2 lg:hidden">
              <ThemeToggle className="border border-[#0b1a29]/15 bg-white/40 text-[#0b1a29]" />
              <Link href="/notifications" aria-label="Notifications" className="press relative grid h-10 w-10 place-items-center rounded-full border border-[#0b1a29]/15 bg-white/40 text-[#0b1a29]">
                <Bell size={19} />
                {unread > 0 && <span className="absolute right-[10px] top-[9px] h-[7px] w-[7px] rounded-full bg-fg ring-2 ring-[var(--bg)]" />}
              </Link>
            </div>
          </div>
        </section>

        <div className="pt-7">
          <SectionTitle action={<Link href="/search" className="text-[12px] text-muted">Search</Link>}>Discover</SectionTitle>
          <p className="mt-1 px-5 text-[13px] text-muted">Find people by craft.</p>
          <HScroll className="mt-4 flex snap-x snap-mandatory gap-3 scroll-px-5 px-5">
            {CRAFTS.map((c, i) => (
              <Link key={c.id} href={`/discover/${c.id}`} className="press rise group w-[168px] shrink-0 snap-start" style={{ animationDelay: `${i * 50}ms` }}>
                <div className="aspect-[4/3] overflow-hidden rounded-[22px] p-2 transition-transform duration-500 group-hover:scale-[1.02]" style={{ background: c.tint }}><CraftArt id={c.id} /></div>
                <div className="mt-2.5 px-1 text-[14.5px] font-medium tracking-[-0.01em]">{c.name}</div>
                <div className="px-1 text-[12px] leading-snug text-muted">{c.blurb}</div>
              </Link>
            ))}
          </HScroll>
        </div>

        <div className="pt-8">
          <SectionTitle action={<div className="flex gap-1.5 text-[12px]"><span className="rounded-full bg-pill px-3 py-1.5 font-medium text-pill-fg">Art</span><Link href="/search" className="rounded-full hairline px-3 py-1.5 text-muted">Requests</Link></div>}>Latest art</SectionTitle>
          {discover === null ? (
            <div className="mt-4"><Skeleton count={3} horizontal /></div>
          ) : discover.length === 0 ? (
            <p className="mt-4 px-5 text-[14px] text-muted">No art posted yet. <Link href="/create" className="text-fg underline-offset-4 hover:underline">Post yours</Link>.</p>
          ) : (
            <HScroll className="mt-4 flex snap-x snap-mandatory gap-3 scroll-px-5 px-5">
              {discover.map((item) => <DiscoverCard key={item.id} post={toPost(item)} />)}
            </HScroll>
          )}
        </div>

        <div className="mx-5 mt-8 rule" />

        <div className="pt-7">
          <SectionTitle action={<Link href="/search" className="text-[12px] text-muted">See all</Link>}>From people you follow</SectionTitle>
          {following === null ? (
            <div className="mt-4"><Skeleton count={2} /></div>
          ) : following.length === 0 ? (
            <p className="mt-4 px-5 text-[14px] text-muted">Follow some people to see their work here.</p>
          ) : (
            <div className="mt-4 flex flex-col gap-4 px-4">
              {following.map((item) => <FeedPost key={item.id} post={toPost(item)} />)}
            </div>
          )}
        </div>
      </div>
    </PullToRefresh>
  );
}
