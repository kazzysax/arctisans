"use client";
import { use, useState, useEffect } from "react";
import Link from "next/link";
import { notFound, useSearchParams, useRouter } from "next/navigation";
import { Mark } from "@/components/Logo";
import { CraftSticker } from "@/components/CraftSticker";
import { craftById } from "@/lib/crafts";
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

const TABS = ["Art", "CV", "Badges", "Reviews"] as const;
const AVAIL: Record<string, string> = { open: "Open to work", limited: "Limited availability", booked: "Booked" };
const iconKind = (label: string) => { const l = label.toLowerCase(); return l === "website" || l === "portfolio" || l === "behance" || l === "telegram" ? "web" : l; };
function CvSection({ n, t, children }: { n: string; t: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h3 className="flex items-baseline gap-2.5 text-[10.5px] uppercase tracking-[0.22em] text-black/45"><span className="num text-black">{n}</span>{t}<span className="h-px flex-1 translate-y-[-3px] bg-black/10" /></h3>
      <div className="mt-2.5">{children}</div>
    </section>
  );
}
const Missing = () => <p className="text-[12.5px] italic text-black/35">Not added yet</p>;

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
  cover?: string | null;
  verified: boolean;
  createdAt: number;
  cv?: { craft?: string; years?: string; rate?: number; delivery?: string; availability?: string; tools?: string[]; clients?: string[]; portfolio?: { img: string; caption?: string }[] };
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
  const [tab, setTab] = useState<(typeof TABS)[number]>("Art");
  const [menu, setMenu] = useState(false);
  const router = useRouter();
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
      <div className="relative mx-auto min-h-dvh max-w-[560px] pb-32">
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
  const coverSrc = p.cover ?? "/demo/bg_blue.jpg";
  const cv = p.cv ?? {};
  const craftName = craftById(cv.craft)?.one ?? null;
  async function share() {
    const url = `${location.origin}/u/${p.handle}`;
    if (navigator.share) await navigator.share({ title: `${p.displayName} · Arctisans CV`, url }).catch(() => null);
    else await navigator.clipboard.writeText(url).catch(() => null);
  }
  async function logOut() {
    await fetch("/api/auth/circle", { method: "DELETE", credentials: "include" });
    await auth.refresh?.();
    router.replace("/signup");
  }
  const scope = p.scope ? p.scope.split("\n").filter(Boolean) : [];
  const skillList = p.skills.map((s) => ({ name: s, jobs: 0 })); // jobs per skill from reputation if needed

  return (
    <div className="relative mx-auto min-h-dvh max-w-[560px] pb-32">
      {/* cover */}
      <div className="relative h-[250px] overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={coverSrc} alt="" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-[var(--bg)]" />
        <div className="absolute inset-x-5 top-[max(16px,env(safe-area-inset-top))] flex items-center justify-between">
          <Back href="/social" />
          {mine ? <div className="flex items-center gap-2"><Link href="/setup" className="press glass flex h-10 items-center rounded-full px-4 text-[13px] font-medium text-fg">Edit profile</Link><button onClick={() => setMenu(true)} aria-label="Account" className="press glass grid h-10 w-10 place-items-center rounded-full text-fg"><Dots size={18} /></button></div>
                : <button aria-label="More" className="press glass grid h-10 w-10 place-items-center rounded-full text-fg"><Dots size={18} /></button>}
        </div>
      </div>

      <div className="relative -mt-[58px] px-5">
        {/* avatar + craft sticker */}
        <div className="relative w-[104px]">
          {p.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.avatar} alt={p.displayName} className="h-[104px] w-[104px] rounded-[32px] object-cover ring-[5px] ring-[var(--bg)]" />
          ) : (
            <div className="flex h-[104px] w-[104px] items-center justify-center rounded-[32px] bg-[var(--img-bg)] ring-[5px] ring-[var(--bg)]" />
          )}
          <CraftSticker craft={cv.craft} size={44} className="absolute -bottom-1 -right-4" />
        </div>

        <div className="mt-4 flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="flex items-center gap-1.5 text-[24px] font-semibold leading-tight tracking-[-0.035em]"><span className="truncate">{p.displayName}</span>{p.verified && <Verified size={18} />}</h1>
            <div className="mt-0.5 text-[14px] text-muted">@{p.handle}{p.title ? ` · ${p.title}` : ""}</div>
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

        <div className="mt-4 flex flex-wrap items-center gap-2 text-muted">
          {p.links.map((l) => <a key={l.label} href={l.url} target="_blank" rel="noreferrer" className="press inline-flex items-center gap-1.5 rounded-full hairline px-3 py-1.5 text-[12.5px] hover:text-fg"><SocialIcon kind={iconKind(l.label)} size={14} />{l.label}</a>)}
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
              <span className="text-[12.5px] text-muted">{earned.length} {earned.length === 1 ? "badge" : "badges"}</span>
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
          {tab === "Art" && (
            <div className="grid grid-cols-3 gap-1.5">
              {posts.length === 0 && <p className="col-span-3 py-8 text-center text-[14px] text-muted">No art posted yet.</p>}
              {posts.flatMap((p) => p.images).slice(0, 9).map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={src} alt="" className={`w-full rounded-[14px] object-cover ${i === 0 ? "col-span-2 row-span-2 aspect-square" : "aspect-square"}`} />
              ))}
            </div>
          )}

          {tab === "CV" && (
            <article className="cv-sheet relative overflow-hidden rounded-[6px] bg-white px-6 pb-6 pt-7 text-[#111] shadow-[0_1px_0_rgba(0,0,0,0.04),0_18px_50px_-20px_rgba(15,34,54,0.35)] ring-1 ring-black/[0.06]">
              {/* letterhead */}
              <header className="flex items-start gap-4">
                {p.avatar ? (/* eslint-disable-next-line @next/next/no-img-element */ <img src={p.avatar} alt="" className="h-[68px] w-[68px] rounded-[14px] object-cover" />)
                  : <div className="h-[68px] w-[68px] rounded-[14px] bg-[var(--img-bg)]" />}
                <div className="min-w-0 flex-1">
                  <h2 className="font-serif text-[27px] font-medium leading-[1.05] tracking-[0.01em]">{p.displayName}</h2>
                  <div className="mt-1 text-[13px] text-black/60">{p.title ?? craftName}</div>
                  <div className="mt-1 text-[12px] text-black/45">@{p.handle}{cv.availability ? ` · ${AVAIL[cv.availability] ?? ""}` : ""}</div>
                </div>
                <Mark size={30} className="shrink-0 text-black/80" />
              </header>
              <div className="mt-5 h-px bg-black/80" /><div className="mt-[3px] h-px bg-black/15" />
              {/* quick facts */}
              <dl className="mt-4 grid grid-cols-3 gap-3 text-[11.5px]">
                {[["Craft", craftName ?? "—"], ["Experience", cv.years ? `${cv.years} yrs` : "—"], ["Rate", cv.rate ? `from $${cv.rate}` : "—"]].map(([k, v]) => (
                  <div key={k}><dt className="text-[9.5px] uppercase tracking-[0.18em] text-black/40">{k}</dt><dd className="mt-1 font-medium leading-tight">{v}</dd></div>
                ))}
              </dl>
              <CvSection n="01" t="Profile">{p.bio ? <p className="text-[13.5px] leading-relaxed text-black/75">{p.bio}</p> : <Missing />}</CvSection>
              <CvSection n="02" t="Scope of work">
                {scope.length ? <ul className="grid grid-cols-1 gap-1.5 text-[13.5px]">{scope.map((x) => <li key={x} className="flex gap-2.5"><span className="mt-[7px] h-[3px] w-[3px] shrink-0 rounded-full bg-black" />{x}</li>)}</ul> : <Missing />}
                {cv.delivery && <p className="mt-2.5 text-[12px] text-black/50">Usual delivery: {cv.delivery}</p>}
              </CvSection>
              {(cv.portfolio?.length ?? 0) > 0 && (
                <CvSection n="03" t="Selected work">
                  <div className="grid grid-cols-3 gap-2">{cv.portfolio!.map((w) => (
                    <figure key={w.img}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={w.img} alt="" className="aspect-square w-full rounded-[6px] bg-[var(--img-bg)] object-cover" />
                      {w.caption && <figcaption className="mt-1 text-[10.5px] leading-tight text-black/55">{w.caption}</figcaption>}</figure>))}</div>
                </CvSection>
              )}
              <CvSection n={(cv.portfolio?.length ?? 0) > 0 ? "04" : "03"} t="Skills & tools">
                {(cv.tools?.length ?? 0) > 0 ? <p className="text-[13px] leading-relaxed text-black/75">{cv.tools!.join("  ·  ")}</p> : <Missing />}
                {(cv.clients?.length ?? 0) > 0 && <p className="mt-2 text-[12px] text-black/55"><span className="text-black/40">Worked with </span>{cv.clients!.join(", ")}</p>}
              </CvSection>
              <CvSection n={(cv.portfolio?.length ?? 0) > 0 ? "05" : "04"} t="Record on Arc">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-black/15 px-2.5 py-1 text-[10.5px] uppercase tracking-[0.14em]"><span className="h-1.5 w-1.5 rounded-full bg-[var(--img-bg)] ring-1 ring-black/30" />Verified on Arc</span>
                  <span className="num text-[10.5px] text-black/40">{p.wallet.slice(0, 6)}…{p.wallet.slice(-4)}</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-x-6 text-[12.5px]">
                  {[["Paid jobs", rep.completed], ["Rating", rep.ratingAvg ? `${rep.ratingAvg.toFixed(1)} ★` : null], ["On time", rep.onTimeRate !== null ? `${Math.round(rep.onTimeRate * 100)}%` : null], ["Earned", rep.earned ? `$${(rep.earned / 1e6).toLocaleString()}` : null],
                    ["Clients", rep.uniqueClients], ["Tips", rep.tipsReceived ? `$${(rep.tipsReceived / 1e6).toFixed(2)}` : null], ["Settled", rep.settled], ["Deadlocks", rep.deadlocked]].map(([k, v]) => (
                    <div key={String(k)} className="flex justify-between border-b border-dotted border-black/15 py-1.5"><span className="text-black/50">{k}</span><span className="num">{v ? v : "—"}</span></div>
                  ))}
                </div>
              </CvSection>
              {p.links.length > 0 && (
                <div className="mt-5 flex flex-wrap gap-x-4 gap-y-1.5 text-[11.5px] text-black/60">
                  {p.links.map((l) => <a key={l.label} href={l.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:text-black"><SocialIcon kind={iconKind(l.label)} size={13} />{l.label}</a>)}
                </div>
              )}
              <footer className="mt-6 flex items-center justify-between border-t border-black/10 pt-3 text-[9.5px] uppercase tracking-[0.16em] text-black/40">
                <span>arctisans.vercel.app/u/{p.handle}</span>
                <span>Issued {new Date().toLocaleDateString("en-GB", { month: "short", year: "numeric" })} · Page 1 of 1</span>
              </footer>
              <div className="no-print mt-5 flex gap-2">
                <button onClick={() => window.print()} className="btn btn-ghost flex-1 !border-black/15 !text-black">Download PDF</button>
                <button onClick={share} className="btn flex-1 bg-black text-white">Share CV</button>
              </div>
            </article>
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

      {/* Account menu */}
      <Sheet open={menu} onClose={() => setMenu(false)} title="Account">
        <div className="flex flex-col">
          <Link href="/setup" className="press border-b border-line py-4 text-[15px]">Edit profile</Link>
          <Link href="/settings" className="press border-b border-line py-4 text-[15px]">Settings</Link>
          <button onClick={share} className="press border-b border-line py-4 text-left text-[15px]">Share my CV</button>
          <button onClick={logOut} className="press py-4 text-left text-[15px] text-red-600">Log out</button>
        </div>
      </Sheet>

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
