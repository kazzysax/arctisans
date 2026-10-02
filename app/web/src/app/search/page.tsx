"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Search as SearchIcon } from "@/components/icons";
import { Verified } from "@/components/Verified";
import { Empty } from "@/components/fun/Empty";
import { useDebounce } from "@/hooks/useDebounce";

const CATS = ["All", "Fashion", "Design", "Writing", "Build", "Agents"] as const;
const CAT_SKILL: Record<string, string | null> = { All: null, Fashion: "fashion", Design: "logo design", Writing: "writing", Build: "web development", Agents: null };
const CAT_KIND: Record<string, "human" | "agent" | null> = { All: null, Fashion: null, Design: null, Writing: null, Build: null, Agents: "agent" };

type Profile = {
  handle: string;
  displayName: string;
  kind: string;
  verified: boolean;
  title: string | null;
  avatar: string | null;
  city: string | null;
};

type RequestPost = {
  id: string;
  handle: string;
  displayName: string;
  body: string;
  skill: string | null;
  budget: number | null;
  createdAt: number;
};

function ago(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

export default function Search() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("All");
  const [view, setView] = useState<"Requests" | "People">("Requests");
  const [people, setPeople] = useState<Profile[] | null>(null);
  const [requests, setRequests] = useState<RequestPost[] | null>(null);
  const [loadingP, setLoadingP] = useState(false);
  const [loadingR, setLoadingR] = useState(false);

  const dq = useDebounce(q, 300);

  const fetchPeople = useCallback(() => {
    setLoadingP(true);
    const params = new URLSearchParams();
    if (dq) params.set("q", dq);
    const skill = CAT_SKILL[cat];
    if (skill) params.set("skill", skill);
    const kind = CAT_KIND[cat];
    if (kind) params.set("kind", kind);
    fetch(`/api/search?${params}`, { credentials: "include" })
      .then((r) => r.json())
      .then((j: { items?: Profile[] }) => setPeople(j.items ?? []))
      .catch(() => setPeople([]))
      .finally(() => setLoadingP(false));
  }, [dq, cat]);

  const fetchRequests = useCallback(() => {
    setLoadingR(true);
    const params = new URLSearchParams({ feed: "request" });
    if (dq) params.set("skill", dq);
    const skill = CAT_SKILL[cat];
    if (skill) params.set("skill", skill);
    fetch(`/api/posts?${params}`, { credentials: "include" })
      .then((r) => r.json())
      .then((j: { items?: RequestPost[] }) => setRequests(j.items ?? []))
      .catch(() => setRequests([]))
      .finally(() => setLoadingR(false));
  }, [dq, cat]);

  useEffect(() => { fetchPeople(); }, [fetchPeople]);
  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const loading = view === "People" ? loadingP : loadingR;

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
        {loading && (
          <div className="mt-4 flex flex-col gap-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-24 animate-pulse rounded-[18px] bg-line" />)}
          </div>
        )}

        {!loading && view === "Requests" && (
          <>
            {(requests ?? []).length === 0 && <Empty art="search" title="No requests yet" body="Be the first to post a request." action={{ href: "/create", label: "Post a request" }} />}
            {(requests ?? []).map((r, i) => (
              <Link href={`/requests/${r.id}`} key={r.id} className={`press block py-5 ${i ? "border-t border-line" : ""}`}>
                <div className="flex items-center gap-2.5 text-[12.5px] text-muted">
                  <div className="h-6 w-6 rounded-[8px] bg-bg-2" />
                  {r.displayName}
                  <span className="text-faint">· {ago(r.createdAt)}</span>
                </div>
                <h3 className="mt-3 text-[17px] font-medium leading-snug tracking-[-0.02em]">{r.body.split("\n")[0] || "Request"}</h3>
                <p className="mt-1.5 line-clamp-2 text-[14px] leading-relaxed text-muted">{r.body}</p>
                <div className="mt-4 flex items-center gap-3">
                  {r.budget && <span className="num text-[18px] font-medium">${(r.budget / 1e6).toFixed(0)}</span>}
                  {r.skill && <span className="text-[12.5px] text-faint">· {r.skill}</span>}
                  <span className="flex-1" /><span className="btn btn-solid btn-sm">View</span>
                </div>
              </Link>
            ))}
          </>
        )}

        {!loading && view === "People" && (
          <div className="flex flex-col">
            {(people ?? []).length === 0 && <Empty art="search" title="Nobody by that name yet" body="Try a skill instead, like &ldquo;tailor&rdquo; or &ldquo;logo&rdquo;." />}
            {(people ?? []).map((p, i) => (
              <Link key={p.handle} href={`/u/${p.handle}`} className={`press flex items-center gap-3 py-3.5 ${i ? "border-t border-line" : ""}`}>
                {p.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.avatar} alt="" className={`h-12 w-12 rounded-[15px] object-cover ${p.kind === "agent" ? "ring-1 ring-fg ring-offset-2 ring-offset-[var(--bg)]" : ""}`} />
                ) : (
                  <div className={`flex h-12 w-12 items-center justify-center rounded-[15px] bg-bg-2 text-[18px] ${p.kind === "agent" ? "ring-1 ring-fg ring-offset-2 ring-offset-[var(--bg)]" : ""}`}>
                    {p.kind === "agent" ? "🤖" : "👤"}
                  </div>
                )}
                <div className="min-w-0 flex-1 leading-tight">
                  <div className="flex items-center gap-1 text-[15px] font-medium">{p.displayName}{p.verified && <Verified size={13} />}</div>
                  <div className="mt-0.5 text-[12.5px] text-muted">{p.title}{p.city ? ` · ${p.city}` : ""}</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
