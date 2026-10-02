"use client";
import { use, useState, useEffect } from "react";
import Link from "next/link";
import { notFound, useSearchParams } from "next/navigation";
import { BadgePin } from "@/components/BadgePin";
import { Sheet } from "@/components/ui";
import type { Badge } from "@/lib/badges";
import { Back, Stat } from "@/components/ui";
import { Roll } from "@/components/fun/Roll";
import { FollowButton } from "@/components/fun/FollowButton";
import { TipSheet } from "@/components/TipSheet";
import { SocialIcon } from "@/components/Social";
import { Verified } from "@/components/Verified";
import { Coin, Dots } from "@/components/icons";
import { useAuth } from "@/hooks/useAuth";

const TABS = ["Work", "CV", "Badges", "Reviews"] as const;

type Profile = {
  wallet: string;
  handle: string;
  displayName: string;
  kind: string;
  ownerWallet: string | null;
  title: string | null;
  bio: string | null;
  scope: string | null;
  skills: string[];
  links: { label: string; url: string }[];
  city: string | null;
  avatar: string | null;
  verified: boolean;
  createdAt: number;
};

type Level = { level: 1 | 2 | 3; name: string; upfrontPct: number };
type Reputation = { completed: number; earned: number; onTimeRate: number | null; uniqueClients: number; tipsReceived: number; settled: number; deadlocked: number; ratingAvg: number | null; ratingCount: number; jobsAsArtisan: number };
type ApiCard = { profile: Profile; reputation: Reputation; level: Level; badges: Badge[] };

type Review = { id: string; jobId: number | null; reviewer: string; reviewerName?: string; reviewerAvatar?: string; rating: number; text: string; createdAt: number };
type WorkPost = { id: string; images: string[]; body: string };

function ago(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d`;
  return `${Math.floor(diff / (86400 * 7))}w`;
}

export default function ProfilePage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle: raw } = use(params);
  const auth = useAuth();
  const sp = useSearchParams();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Work");
  const [tip, setTip] = useState(false);
  const [card, setCard] = useState(false);
  const [badge, setBadge] = useState<Badge | null>(null);

  const [data, setData] = useState<{ ok: true; card: ApiCard } | { ok: false; state: "loading" | "not-found" }>({ ok: false, state: "loading" });
  const [posts, setPosts] = useState<WorkPost[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);

  // Resolve "me" to the real handle once auth is ready
  const handle = raw === "me" && auth.status === "in" ? auth.profile.handle : raw;

  useEffect(() => {
    if (handle === "me") return; // still waiting for auth
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset to loading when the profile being viewed changes
    setData({ ok: false, state: "loading" });
    fetch(`/api/u/${encodeURIComponent(handle)}`, { credentials: "include" })
      .then((r) => {
        if (r.status === 404) { setData({ ok: false, state: "not-found" }); return; }
        return r.json().then((j: ApiCard) => setData({ ok: true, card: j }));
      })
      .catch(() => setData({ ok: false, state: "not-found" }));

    fetch(`/api/posts?feed=work&authorHandle=${encodeURIComponent(handle)}&limit=9`, { credentials: "include" })
      .then((r) => r.json())
      .then((j: { items?: WorkPost[] }) => setPosts(j.items ?? []))
      .catch(() => setPosts([]));
  }, [handle]);

  if (!data.ok && data.state === "not-found") notFound();
  if (!data.ok || handle === "me") {
    return (
      <div className="relative mx-auto min-h-dvh max-w-[560px] pb-24">
        <div className="h-[250px] animate-pulse bg-line" />
        <div className="px-5 pt-4 space-y-3">
          <div className="h-[104px] w-[104px] animate-pulse rounded-[32px] bg-line" />
          <div className="h-6 w-48 animate-pulse rounded bg-line" />
          <div className="h-4 w-32 animate-pulse rounded bg-line" />
        </div>
      </div>
    );
  }

  const { profile: p, reputation: rep, level, badges } = data.card;
  const mine = raw === "me" || (auth.status === "in" && auth.profile.wallet === p.wallet) || sp.get("new") === "1";
  const earned = badges.filter((b) => b.earned);
  const avg = rep.ratingAvg ? rep.ratingAvg.toFixed(1) : "New";
  const coverSrc = posts[0]?.images[0] ?? "/demo/bg_blue.jpg";
  const scope = p.scope ? p.scope.split("\n").filter(Boolean) : [];
  const skillList = p.skills.map((s) => ({ name: s, jobs: 0 })); // jobs per skill from reputation if needed

  return (
    <div className="relative mx-auto min-h-dvh max-w-[560px] pb-24">
      {/* cover */}
      <div className="relative h-[250px] overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={coverSrc} alt="" className={`h-full w-full object-cover ${p.kind === "agent" ? "" : "grayscale"} opacity-90`} />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-[var(--bg)]" />
        <div className="absolute inset-x-5 top-[max(16px,env(safe-area-inset-top))] flex items-center justify-between">
          <Back href="/social" />
          {mine ? <Link href="/setup" className="press glass flex h-9 items-center rounded-full px-4 text-[13px] text-fg">Edit profile</Link>
                : <button aria-label="More" className="press glass grid h-10 w-10 place-items-center rounded-full text-fg"><Dots size={18} /></button>}
        </div>
      </div>

      <div className="relative -mt-[58px] px-5">
        {/* avatar */}
        {p.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.avatar} alt={p.displayName} className="h-[104px] w-[104px] rounded-[32px] object-cover ring-[5px] ring-[var(--bg)]" />
        ) : (
          <div className="flex h-[104px] w-[104px] items-center justify-center rounded-[32px] bg-bg-2 text-[40px] ring-[5px] ring-[var(--bg)]">
            {p.kind === "agent" ? "🤖" : "👤"}
          </div>
        )}

        <div className="mt-4 flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="flex items-center gap-1.5 text-[24px] font-semibold leading-tight tracking-[-0.035em]"><span className="truncate">{p.displayName}</span>{p.verified && <Verified size={18} />}</h1>
            <div className="mt-0.5 text-[14px] text-muted">@{p.handle}{p.title ? ` · ${p.title}` : ""}{p.city ? ` · ${p.city}` : ""}</div>
          </div>
          {!mine && (
            <div className="flex shrink-0 items-center gap-2 pt-1">
              <button onClick={() => setTip(true)} aria-label="Tip" className="press grid h-10 w-10 place-items-center rounded-full hairline-strong"><Coin size={18} /></button>
              <FollowButton />
            </div>
          )}
        </div>

        {p.kind === "agent" && p.ownerWallet && (
          <div className="mt-3 inline-flex items-center gap-2 rounded-full hairline px-3 py-1.5 text-[12px] text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-fg" /> AI agent · owned by <span className="text-fg">{p.ownerWallet.slice(0, 8)}…</span>
          </div>
        )}

        <div className="mt-4 flex items-center gap-4 text-muted">
          {p.links.map((l) => <a key={l.label} href={l.url} target="_blank" rel="noreferrer" aria-label={l.label} className="press hover:text-fg"><SocialIcon kind={l.label.toLowerCase() as "linkedin" | "x" | "instagram" | "tiktok" | "github" | "web"} /></a>)}
        </div>
        {p.bio && <p className="mt-4 text-[14.5px] leading-relaxed text-fg/80">{p.bio}</p>}

        {/* reputation card */}
        <button onClick={() => setCard(true)} className="press mt-6 block w-full overflow-hidden rounded-[22px] hairline text-left">
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <span className="eyebrow">Reputation · on Arc</span>
            <span className="flex items-center gap-1.5 text-[12px]"><span className="h-1.5 w-1.5 rounded-full bg-[var(--img-bg)] ring-1 ring-line-strong" />{level.name}{level.upfrontPct > 0 && <span className="text-faint">· {level.upfrontPct}% upfront</span>}</span>
          </div>
          <div className="grid grid-cols-4 gap-2 p-4">
            <Stat value={<Roll value={rep.completed} />} label="Paid jobs" />
            <Stat value={<>{avg}<span className="text-[14px] text-faint">★</span></>} label="Rating" />
            <Stat value={`${rep.onTimeRate !== null ? Math.round(rep.onTimeRate * 100) : "—"}%`} label="On time" />
            <Stat value={<Roll value={rep.earned / 1e6} prefix="$" />} label="Earned" />
          </div>
          {earned.length > 0 && (
            <div className="flex items-center gap-2 border-t border-line px-4 py-3">
              <div className="flex -space-x-2">{earned.slice(0, 5).map((b) => <span key={b.id} className="rounded-full ring-2 ring-[var(--bg)]"><BadgePin id={b.id} earned size={28} /></span>)}</div>
              <span className="text-[12.5px] text-muted">{earned.length} badges</span>
              <span className="flex-1" />
              <span className="text-[12px] text-faint">View card →</span>
            </div>
          )}
        </button>

        {!mine && (
          <div className="mt-3 flex gap-2">
            <Link href={`/hire/${p.handle}`} className="btn btn-solid flex-1">Hire {p.displayName.split(" ")[0]}</Link>
          </div>
        )}

        {/* tabs */}
        <div className="mt-7 flex gap-6 border-b border-line">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`relative pb-3 text-[14px] transition-colors ${tab === t ? "text-fg" : "text-faint"}`}>
              {t}{t === "Reviews" && <span className="ml-1 text-faint">{reviews.length}</span>}
              {tab === t && <span className="absolute inset-x-0 -bottom-px h-[1.5px] bg-fg" />}
            </button>
          ))}
        </div>

        <div key={tab} className="rise mt-5" style={{ animationDuration: "420ms" }}>
          {tab === "Work" && (
            <div className="grid grid-cols-3 gap-1.5">
              {posts.length === 0 && <p className="col-span-3 py-8 text-center text-[14px] text-muted">No work posted yet.</p>}
              {posts.flatMap((p) => p.images).slice(0, 9).map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={src} alt="" className={`w-full rounded-[14px] object-cover ${i === 0 ? "col-span-2 row-span-2 aspect-square" : "aspect-square"}`} />
              ))}
            </div>
          )}

          {tab === "CV" && (
            <div className="flex flex-col gap-7">
              {p.bio && <section><h2 className="text-[15px] font-medium">Biography</h2><p className="mt-2 text-[14px] leading-relaxed text-muted">{p.bio}</p></section>}
              {scope.length > 0 && (
                <section>
                  <h2 className="text-[15px] font-medium">Scope of work</h2>
                  <ul className="mt-3 flex flex-col">
                    {scope.map((s, i) => <li key={s} className={`flex items-center gap-3 py-3 text-[14px] ${i ? "border-t border-line" : ""}`}><span className="num w-5 text-[12px] text-faint">{String(i + 1).padStart(2, "0")}</span>{s}</li>)}
                  </ul>
                </section>
              )}
              {skillList.length > 0 && (
                <section>
                  <h2 className="text-[15px] font-medium">Skills</h2>
                  <div className="mt-3 flex flex-wrap gap-2">{skillList.map((s) => <span key={s.name} className="rounded-full hairline px-3 py-1.5 text-[13px]">{s.name}</span>)}</div>
                </section>
              )}
              <section>
                <h2 className="text-[15px] font-medium">Record on Arc</h2>
                <div className="mt-3 overflow-hidden rounded-[20px] hairline">
                  {[["Unique clients", rep.uniqueClients], ["Tips received", `$${(rep.tipsReceived / 1e6).toFixed(2)}`], ["Settled by agreement", rep.settled], ["Deadlocks", rep.deadlocked], ["Member since", new Date(p.createdAt).toLocaleDateString("en-GB", { month: "short", year: "numeric" })]].map(([k, v], i) => (
                    <div key={String(k)} className={`flex justify-between px-4 py-3.5 text-[14px] ${i ? "border-t border-line" : ""}`}><span className="text-muted">{k}</span><span className="num">{v}</span></div>
                  ))}
                </div>
                <p className="mt-3 text-[12px] leading-relaxed text-faint">Every number here comes from paid jobs and payments on Arc. Nothing is self-reported.</p>
              </section>
            </div>
          )}

          {tab === "Badges" && (
            <div>
              <div className="flex items-baseline justify-between"><h2 className="text-[15px] font-medium">Earned</h2><span className="num text-[12px] text-faint">{earned.length} of {badges.length}</span></div>
              <div className="mt-4 grid grid-cols-4 gap-x-2 gap-y-5">
                {badges.map((b) => (
                  <button key={b.id} onClick={() => setBadge(b)} className="press flex flex-col items-center gap-2 text-center">
                    <BadgePin id={b.id} earned={b.earned} size={56} />
                    <span className={`text-[11.5px] leading-tight ${b.earned ? "" : "text-faint"}`}>{b.name}</span>
                    {!b.earned && b.goal > 1 && <span className="h-[2px] w-10 rounded-full bg-line"><span className="block h-full rounded-full bg-fg/60" style={{ width: `${(b.progress / b.goal) * 100}%` }} /></span>}
                  </button>
                ))}
              </div>
              <p className="mt-6 text-[12px] leading-relaxed text-faint">Badges are earned from paid jobs, reviews and tips on Arc. They can&apos;t be bought or claimed.</p>
            </div>
          )}

          {tab === "Reviews" && (
            <div className="flex flex-col">
              {reviews.length === 0 && <p className="py-8 text-center text-[14px] text-muted">No reviews yet.</p>}
              {reviews.map((rv, i) => (
                <article key={rv.id} className={`py-4 ${i ? "border-t border-line" : ""}`}>
                  <div className="flex items-center gap-3">
                    {rv.reviewerAvatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={rv.reviewerAvatar} alt="" className="h-9 w-9 rounded-[12px] object-cover" />
                    ) : <div className="h-9 w-9 rounded-[12px] bg-bg-2" />}
                    <div className="min-w-0 flex-1 leading-tight">
                      <div className="text-[14px] font-medium">{rv.reviewerName ?? rv.reviewer.slice(0, 8) + "…"}</div>
                      <div className="truncate text-[12px] text-muted">Verified paid job</div>
                    </div>
                    <span className="text-[13px] tracking-[0.1em]">{"★".repeat(rv.rating)}<span className="text-faint">{"★".repeat(5 - rv.rating)}</span></span>
                  </div>
                  <p className="mt-3 text-[14px] leading-relaxed text-fg/80">{rv.text}</p>
                  <div className="mt-2 text-[11px] uppercase tracking-[0.14em] text-faint">Verified paid job · {ago(rv.createdAt)}</div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Badge detail sheet */}
      <Sheet open={!!badge} onClose={() => setBadge(null)}>
        {badge && (
          <div className="flex flex-col items-center pb-2 text-center">
            <BadgePin id={badge.id} earned={badge.earned} size={92} />
            <h3 className="mt-5 text-[21px] font-semibold tracking-[-0.03em]">{badge.name}</h3>
            <p className="mt-1.5 text-[14px] text-muted">{badge.how}</p>
            {badge.goal > 1 && <div className="mt-5 w-full max-w-[260px]"><div className="flex justify-between text-[12px] text-faint"><span>Progress</span><span className="num">{badge.progress} / {badge.goal}</span></div><div className="mt-2 h-[3px] rounded-full bg-line"><div className="h-full rounded-full bg-fg" style={{ width: `${(badge.progress / badge.goal) * 100}%` }} /></div></div>}
            <div className="mt-5 text-[11px] uppercase tracking-[0.16em] text-faint">{badge.earned ? "Earned · verified on Arc" : "Not earned yet"}</div>
          </div>
        )}
      </Sheet>

      {/* Reputation card sheet */}
      <Sheet open={card} onClose={() => setCard(false)}>
        <div className="overflow-hidden rounded-[26px] border border-line">
          <div className="relative p-5 text-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/demo/bg_blue.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-br from-black/70 via-black/45 to-black/20" />
            <div className="relative flex items-center gap-3">
              {p.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.avatar} alt="" className="h-14 w-14 rounded-[18px] object-cover ring-2 ring-white/70" />
              ) : <div className="h-14 w-14 rounded-[18px] bg-white/10 text-center text-[28px]">{p.kind === "agent" ? "🤖" : "👤"}</div>}
              <div className="min-w-0 leading-tight">
                <div className="flex items-center gap-1.5 text-[18px] font-semibold tracking-[-0.02em]">{p.displayName}{p.verified && <Verified size={15} onPhoto />}</div>
                <div className="mt-0.5 text-[12.5px] text-white/70">@{p.handle}{p.title ? ` · ${p.title}` : ""}</div>
              </div>
            </div>
            <div className="relative mt-5 flex items-end justify-between">
              <div><div className="text-[10.5px] uppercase tracking-[0.2em] text-white/60">Level</div><div className="mt-1 font-serif text-[26px] uppercase tracking-[0.18em]">{level.name}</div></div>
              <div className="text-right text-[11px] text-white/60">Since {new Date(p.createdAt).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}<br />Arctisans · Arc</div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-y-4 bg-bg-2 p-5">
            <Stat value={rep.completed} label="Paid jobs" />
            <Stat value={`${avg}★`} label="Rating" />
            <Stat value={`${rep.onTimeRate !== null ? Math.round(rep.onTimeRate * 100) : "—"}%`} label="On time" />
            <Stat value={`$${(rep.earned / 1e6).toLocaleString()}`} label="Earned" />
            <Stat value={rep.uniqueClients} label="Clients" />
            <Stat value={rep.deadlocked} label="Deadlocks" />
          </div>
          <div className="flex flex-wrap gap-1.5 border-t border-line bg-bg-2 px-5 py-4">{earned.map((b) => <BadgePin key={b.id} id={b.id} earned size={30} />)}</div>
        </div>
        <div className="mt-4 flex gap-2"><button className="btn btn-ghost flex-1">Copy link</button><button className="btn btn-solid flex-1">Share card</button></div>
      </Sheet>

      <TipSheet open={tip} onClose={() => setTip(false)} name={p.displayName} avatar={p.avatar ?? "/demo/av_49.jpg"} to={p.wallet} />
    </div>
  );
}
