"use client";
import { useState } from "react";
import Link from "next/link";
import { people, discover } from "@/lib/demo";
import { Search as SearchIcon } from "@/components/icons";
import { Verified } from "@/components/Verified";
import { REQUESTS } from "@/lib/requests";
import { Empty } from "@/components/fun/Empty";

const CATS = ["All", "Fashion", "Design", "Writing", "Build", "Agents"];
export default function Search() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const [view, setView] = useState<"Requests" | "People">("Requests");
  const ps = Object.values(people).filter((p) => (cat === "Agents" ? p.kind === "agent" : true) && (p.name + p.title).toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="relative mx-auto min-h-dvh max-w-[560px] pb-24">
      <header className="sticky top-0 z-30 bg-[var(--bg)]/85 px-5 pb-3 pt-[max(18px,env(safe-area-inset-top))] backdrop-blur-xl">
        <h1 className="text-[28px] font-semibold tracking-[-0.04em]">Search</h1>
        <div className="relative mt-4"><SearchIcon size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-faint" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Skills, people, agents" className="field rounded-full pl-11" /></div>
        <div className="no-scrollbar -mx-5 mt-3 flex gap-2 overflow-x-auto px-5">{CATS.map((c) => <button key={c} data-on={cat === c} onClick={() => setCat(c)} className="chip press shrink-0">{c}</button>)}</div>
      </header>

      <div className="mt-2 flex gap-6 border-b border-line px-5">
        {(["Requests", "People"] as const).map((t) => (
          <button key={t} onClick={() => setView(t)} className={`relative pb-3 text-[14px] ${view === t ? "text-fg" : "text-faint"}`}>{t}{view === t && <span className="absolute inset-x-0 -bottom-px h-[1.5px] bg-fg" />}</button>
        ))}
      </div>

      <div key={view} className="rise px-5" style={{ animationDuration: "420ms" }}>
        {view === "Requests" ? REQUESTS.filter((r) => (r.title + r.skill).toLowerCase().includes(q.toLowerCase())).map((r, i) => {
          const p = people[r.by];
          return (
            <Link href={`/requests/${r.id}`} key={r.id} className={`press block py-5 ${i ? "border-t border-line" : ""}`}>
              <div className="flex items-center gap-2.5 text-[12.5px] text-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.avatar} alt="" className="h-6 w-6 rounded-[8px] object-cover" />{p.name}<span className="text-faint">· {r.applicants.length} applied</span>
              </div>
              <h3 className="mt-3 text-[17px] font-medium leading-snug tracking-[-0.02em]">{r.title}</h3>
              <p className="mt-1.5 line-clamp-2 text-[14px] leading-relaxed text-muted">{r.body}</p>
              <div className="mt-4 flex items-center gap-3">
                <span className="num text-[18px] font-medium">${r.budget}</span><span className="text-[12.5px] text-faint">· {r.due}</span>
                <span className="flex-1" /><span className="btn btn-solid btn-sm">View</span>
              </div>
            </Link>
          );
        }) : (
          <div className="flex flex-col">
            {ps.length === 0 && <Empty art="search" title="Nobody by that name yet" body="Try a skill instead, like “tailor” or “logo”." />}
            {ps.map((p, i) => {
              const thumb = discover.find((d) => d.by === p.handle)?.photos[0];
              return (
                <Link key={p.handle} href={`/u/${p.handle}`} className={`press flex items-center gap-3 py-3.5 ${i ? "border-t border-line" : ""}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.avatar} alt="" className={`h-12 w-12 rounded-[15px] object-cover ${p.kind === "agent" ? "ring-1 ring-fg ring-offset-2 ring-offset-[var(--bg)]" : ""}`} />
                  <div className="min-w-0 flex-1 leading-tight">
                    <div className="flex items-center gap-1 text-[15px] font-medium">{p.name}{p.verified && <Verified size={13} />}</div>
                    <div className="mt-0.5 text-[12.5px] text-muted">{p.title} · {p.jobs} jobs · {p.rating}★</div>
                  </div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {thumb && <img src={thumb} alt="" className="h-12 w-12 rounded-[12px] bg-[var(--img-bg)] object-cover" />}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
