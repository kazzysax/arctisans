"use client";
import { use, useState } from "react";
import Link from "next/link";
import { notFound, useSearchParams } from "next/navigation";
import { people, profileOf, portfolio, reviews, discover } from "@/lib/demo";
import { Back, Stat } from "@/components/ui";
import { TabBar } from "@/components/TabBar";
import { TipSheet } from "@/components/TipSheet";
import { SocialIcon } from "@/components/Social";
import { Verified } from "@/components/Verified";
import { Coin, Dots } from "@/components/icons";

const TABS = ["Work", "CV", "Reviews"] as const;

export default function ProfilePage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle: raw } = use(params);
  const handle = raw === "me" ? "amara" : raw;
  const p = people[handle];
  const sp = useSearchParams();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Work");
  const [following, setFollowing] = useState(false);
  const [tip, setTip] = useState(false);
  if (!p) notFound();
  const f = profileOf(handle);
  const mine = raw === "me" || sp.get("new") === "1";
  const work = portfolio[handle] ?? discover.filter((d) => d.by === handle).flatMap((d) => d.photos).concat(["/demo/work_laptop.jpg", "/demo/work_fashion.jpg"]).slice(0, 6);
  const avg = p.rating ? p.rating.toFixed(1) : "New";

  return (
    <div className="relative mx-auto min-h-dvh max-w-[480px] pb-24">
      {/* cover: photo fading into the page, back + edit/more on glass */}
      <div className="relative h-[250px] overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={f.cover} alt="" className={`h-full w-full object-cover ${p.kind === "agent" ? "" : "grayscale"} opacity-90`} />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-[var(--bg)]" />
        <div className="absolute inset-x-5 top-[max(16px,env(safe-area-inset-top))] flex items-center justify-between">
          <Back href="/social" />
          {mine ? <Link href="/setup" className="press glass flex h-9 items-center rounded-full px-4 text-[13px] text-fg">Edit profile</Link>
                : <button aria-label="More" className="press glass grid h-10 w-10 place-items-center rounded-full text-fg"><Dots size={18} /></button>}
        </div>
      </div>

      <div className="relative -mt-[58px] px-5">
        {/* avatar: rounded square with a ring in the page colour */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={p.avatar} alt={p.name} className="h-[104px] w-[104px] rounded-[32px] object-cover ring-[5px] ring-[var(--bg)]" />

        <div className="mt-4 flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="flex items-center gap-1.5 text-[24px] font-semibold leading-tight tracking-[-0.035em]"><span className="truncate">{p.name}</span>{p.verified && <Verified size={18} />}</h1>
            <div className="mt-0.5 text-[14px] text-muted">@{p.handle} · {p.title} · {p.city}</div>
          </div>
          {!mine && (
            <div className="flex shrink-0 items-center gap-2 pt-1">
              <button onClick={() => setTip(true)} aria-label="Tip" className="press grid h-10 w-10 place-items-center rounded-full hairline-strong"><Coin size={18} /></button>
              <button onClick={() => setFollowing(!following)} className={`press h-10 rounded-full px-4 text-[13px] font-medium transition-colors ${following ? "hairline-strong" : "bg-pill text-pill-fg"}`}>{following ? "Following" : "Follow"}</button>
            </div>
          )}
        </div>

        {p.kind === "agent" && f.owner && (
          <div className="mt-3 inline-flex items-center gap-2 rounded-full hairline px-3 py-1.5 text-[12px] text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-fg" /> AI agent · Agent #{f.agentId} · owned by <Link href={`/u/${f.owner}`} className="text-fg">@{f.owner}</Link>
          </div>
        )}

        <div className="mt-4 flex items-center gap-4 text-muted">
          {f.links.map((l) => <a key={l.kind} href={l.url} target="_blank" rel="noreferrer" aria-label={l.kind} className="press hover:text-fg"><SocialIcon kind={l.kind} /></a>)}
        </div>
        <p className="mt-4 text-[14.5px] leading-relaxed text-fg/80">{f.bio}</p>

        {/* reputation strip: facts only */}
        <div className="mt-6 grid grid-cols-4 gap-2 rounded-[22px] hairline p-4">
          <Stat value={p.jobs} label="Paid jobs" />
          <Stat value={<>{avg}<span className="text-[14px] text-faint">★</span></>} label="Rating" />
          <Stat value={`${f.onTime}%`} label="On time" />
          <Stat value={`$${(f.earned / 1000).toFixed(1)}k`} label="Earned" />
        </div>

        {!mine && (
          <div className="mt-3 flex gap-2">
            <Link href={`/hire/${p.handle}`} className="btn btn-solid flex-1">Hire {p.name.split(" ")[0]}</Link>
          </div>
        )}

        {/* tabs: underline sits on a hairline */}
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
              {work.map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={src} alt="" className={`w-full rounded-[14px] object-cover ${i === 0 ? "col-span-2 row-span-2 aspect-square" : "aspect-square"}`} />
              ))}
            </div>
          )}

          {tab === "CV" && (
            <div className="flex flex-col gap-7">
              <section>
                <h2 className="text-[15px] font-medium">Biography</h2>
                <p className="mt-2 text-[14px] leading-relaxed text-muted">{f.bio}</p>
              </section>
              <section>
                <h2 className="text-[15px] font-medium">Scope of work</h2>
                <ul className="mt-3 flex flex-col">
                  {f.scope.map((s, i) => <li key={s} className={`flex items-center gap-3 py-3 text-[14px] ${i ? "border-t border-line" : ""}`}><span className="num w-5 text-[12px] text-faint">{String(i + 1).padStart(2, "0")}</span>{s}</li>)}
                </ul>
              </section>
              <section>
                <h2 className="text-[15px] font-medium">Skills, proven by paid jobs</h2>
                <div className="mt-3 flex flex-col gap-3">
                  {f.skills.map((s) => {
                    const max = Math.max(...f.skills.map((x) => x.jobs));
                    return (
                      <div key={s.name}>
                        <div className="flex justify-between text-[13.5px]"><span>{s.name}</span><span className="num text-muted">{s.jobs} jobs</span></div>
                        <div className="mt-2 h-[3px] rounded-full bg-line"><div className="h-full rounded-full bg-fg" style={{ width: `${(s.jobs / max) * 100}%` }} /></div>
                      </div>
                    );
                  })}
                </div>
              </section>
              <section>
                <h2 className="text-[15px] font-medium">Record on Arc</h2>
                <div className="mt-3 overflow-hidden rounded-[20px] hairline">
                  {[["Unique clients", f.clients], ["Tips received", `$${f.tips}`], ["Settled by agreement", f.settled], ["Deadlocks", f.deadlocked], ["Member since", f.since]].map(([k, v], i) => (
                    <div key={String(k)} className={`flex justify-between px-4 py-3.5 text-[14px] ${i ? "border-t border-line" : ""}`}><span className="text-muted">{k}</span><span className="num">{v}</span></div>
                  ))}
                </div>
                <p className="mt-3 text-[12px] leading-relaxed text-faint">Every number here comes from paid jobs and payments on Arc. Nothing is self-reported.</p>
              </section>
            </div>
          )}

          {tab === "Reviews" && (
            <div className="flex flex-col">
              {reviews.map((r, i) => {
                const by = people[r.by];
                return (
                  <article key={i} className={`py-4 ${i ? "border-t border-line" : ""}`}>
                    <div className="flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={by.avatar} alt="" className="h-9 w-9 rounded-[12px] object-cover" />
                      <div className="min-w-0 flex-1 leading-tight">
                        <div className="text-[14px] font-medium">{by.name}</div>
                        <div className="truncate text-[12px] text-muted">{r.job} · ${r.amount} paid</div>
                      </div>
                      <span className="text-[13px] tracking-[0.1em]">{"★".repeat(r.rating)}<span className="text-faint">{"★".repeat(5 - r.rating)}</span></span>
                    </div>
                    <p className="mt-3 text-[14px] leading-relaxed text-fg/80">{r.text}</p>
                    <div className="mt-2 text-[11px] uppercase tracking-[0.14em] text-faint">Verified paid job · {r.ago}</div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <TipSheet open={tip} onClose={() => setTip(false)} name={p.name} avatar={p.avatar} />
      <TabBar />
    </div>
  );
}
