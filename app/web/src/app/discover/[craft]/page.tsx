"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Back } from "@/components/ui";
import { CraftArt } from "@/components/CraftArt";
import { Verified } from "@/components/Verified";
import { CraftSticker } from "@/components/CraftSticker";
import { craftById, CRAFTS } from "@/lib/crafts";

type P = { handle: string; displayName: string; title: string | null; avatar: string | null; verified: boolean; kind: string;
  cv?: { rate?: number; availability?: string; years?: string } };
const AV: Record<string, string> = { open: "Open to work", limited: "Limited", booked: "Booked" };

export default function CraftPage({ params }: { params: Promise<{ craft: string }> }) {
  const { craft } = use(params);
  const c = craftById(craft);
  const [people, setPeople] = useState<P[] | null>(null);
  useEffect(() => {
    if (!c) return;
    const q = `craft=${c.id}`;
    fetch(`/api/search?${q}`, { credentials: "include" }).then((r) => r.json()).then((j: { items?: (P | null)[] }) => setPeople((j.items ?? []).filter(Boolean) as P[])).catch(() => setPeople([]));
  }, [c]);
  if (!c) notFound();
  return (
    <main className="mx-auto min-h-dvh max-w-[560px] pb-32">
      <div className="relative">
        <div className="h-[230px] px-10 pb-2 pt-14" style={{ background: c.tint }}><CraftArt id={c.id} /></div>
        <div className="absolute left-5 top-[max(16px,env(safe-area-inset-top))]"><Back href="/social" /></div>
      </div>
      <div className="px-5 pt-5">
        <div className="eyebrow">Discover</div>
        <h1 className="mt-1 text-[30px] font-semibold tracking-[-0.035em]">{c.name}</h1>
        <p className="mt-1 text-[14px] text-muted">{c.blurb}</p>
        <div className="mt-6 flex flex-col">
          {people === null && Array.from({ length: 3 }).map((_, i) => <div key={i} className="mb-3 h-[72px] animate-pulse rounded-[20px] bg-line" />)}
          {people?.length === 0 && <p className="py-10 text-center text-[14px] text-muted">No {c.name.toLowerCase()} yet. Be the first.</p>}
          {people?.map((p, i) => (
            <Link key={p.handle} href={`/u/${p.handle}`} className={`press flex items-center gap-3 py-3.5 ${i ? "border-t border-line" : ""}`}>
              <div className="relative shrink-0">
                {p.avatar ? (/* eslint-disable-next-line @next/next/no-img-element */ <img src={p.avatar} alt="" className="h-12 w-12 rounded-[15px] object-cover" />)
                  : <div className="h-12 w-12 rounded-[15px] bg-[var(--img-bg)]" />}
                <CraftSticker craft={c.id} size={22} className="absolute -bottom-1 -right-1.5 !ring-2" />
              </div>
              <div className="min-w-0 flex-1 leading-tight">
                <div className="flex items-center gap-1.5 text-[15px] font-medium"><span className="truncate">{p.displayName}</span>{p.verified && <Verified size={14} />}</div>
                <div className="mt-1 truncate text-[12.5px] text-muted">{p.kind === "agent" && <span className="mr-1.5 rounded-full bg-[var(--img-bg)] px-1.5 py-0.5 text-[10.5px] text-[#0b1a29]">AI agent</span>}{p.title ?? `@${p.handle}`}</div>
              </div>
              <div className="text-right text-[12px] leading-tight">
                {p.cv?.rate ? <div className="num">from ${p.cv.rate}</div> : null}
                {p.cv?.availability && <div className="mt-1 text-faint">{AV[p.cv.availability]}</div>}
              </div>
            </Link>
          ))}
        </div>
        <div className="mt-10 eyebrow">Other crafts</div>
        <div className="mt-3 flex flex-wrap gap-2">{CRAFTS.filter((x) => x.id !== c.id).map((x) => <Link key={x.id} href={`/discover/${x.id}`} className="chip press !border-transparent !text-[#0b1a29]" style={{ background: x.tint }}>{x.name}</Link>)}</div>
      </div>
    </main>
  );
}
