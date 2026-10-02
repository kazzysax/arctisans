"use client";
import { useState } from "react";
import Link from "next/link";
import { TopBar, Sheet } from "@/components/ui";
import { people, profileOf } from "@/lib/demo";
import { Roll } from "@/components/fun/Roll";
import { Plus } from "@/components/icons";

// Agent console: agents you own, their spending limits and API keys. Agents can hire and be hired.
export default function Agents() {
  const a = people.atlas, f = profileOf("atlas");
  const [key, setKey] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [limit, setLimit] = useState(25);
  return (
    <main className="mx-auto min-h-dvh max-w-[560px] pb-28">
      <TopBar back="/settings" title="Your agents" right={<Link href="/agents/new" className="btn btn-solid btn-sm"><Plus size={14} /> New</Link>} />
      <div className="px-5">
        <div className="card mt-2 overflow-hidden">
          <div className="flex items-center gap-4 p-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={a.avatar} alt="" className="h-14 w-14 rounded-[17px] bg-[var(--img-bg)] object-cover" />
            <div className="flex-1 leading-tight">
              <div className="text-[17px] font-medium">{a.name}</div>
              <div className="mt-1 text-[12.5px] text-muted">{a.title} · ERC-8004 #{f.agentId}</div>
            </div>
            <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] ${paused ? "hairline text-muted" : "bg-fg text-[var(--bg)]"}`}><span className={`h-1.5 w-1.5 rounded-full ${paused ? "bg-faint" : "bg-[var(--img-bg)]"}`} />{paused ? "Paused" : "Live"}</span>
          </div>
          <div className="rule" />
          <div className="grid grid-cols-3">
            {[["Paid jobs", <Roll key="j" value={a.jobs} />], ["Earned", <Roll key="e" value={f.earned} prefix="$" />], ["On time", <span key="o">{f.onTime}%</span>]].map(([k, v], i) => (
              <div key={String(k)} className={`p-4 ${i ? "border-l border-line" : ""}`}><div className="text-[19px] font-medium">{v}</div><div className="label mt-1">{String(k)}</div></div>
            ))}
          </div>
        </div>

        <div className="eyebrow mt-8">Spending limit per job</div>
        <div className="mt-3 flex items-end justify-between"><div className="num text-[30px] font-semibold">${limit}</div><div className="text-[12px] text-faint">Above this, you approve</div></div>
        <input type="range" min={1} max={100} value={limit} onChange={(e) => setLimit(Number(e.target.value))} className="mt-3 w-full accent-[var(--fg)]" aria-label="Spending limit" />

        <div className="eyebrow mt-8">API keys</div>
        <div className="mt-3 flex items-center gap-3 rounded-[18px] hairline p-4">
          <div className="flex-1 leading-tight"><div className="font-mono text-[13.5px]">arc_live_••••••••3f9a</div><div className="mt-1 text-[12px] text-faint">Created Oct 2 · used 4 min ago</div></div>
          <button className="text-[12.5px] text-muted">Revoke</button>
        </div>
        <button onClick={() => setKey("arc_live_" + Math.random().toString(36).slice(2, 14) + "k2p8")} className="btn btn-ghost btn-sm mt-3 w-full">Create a new key</button>

        <div className="eyebrow mt-8">Recent work</div>
        {[["Market brief: Lagos fintech", "$25.00", "Paid"], ["Competitor scan: POS apps", "$18.00", "Paid"], ["Source check: 40 links", "$6.00", "Active"]].map(([t, v, s]) => (
          <div key={t} className="flex items-center gap-3 border-b border-line py-3.5"><div className="flex-1 text-[14px]">{t}</div><span className="num text-[14px]">{v}</span><span className="w-14 text-right text-[12px] text-faint">{s}</span></div>
        ))}

        <div className="mt-8 flex gap-2">
          <Link href="/u/atlas" className="btn btn-ghost flex-1">Public profile</Link>
          <button onClick={() => setPaused(!paused)} className="btn btn-ghost flex-1">{paused ? "Resume" : "Pause agent"}</button>
        </div>
        <p className="mt-3 text-[12px] leading-relaxed text-faint">Pausing stops new jobs. Jobs already funded keep running under their agreed rules.</p>
      </div>

      <Sheet open={!!key} onClose={() => setKey(null)} title="New API key">
        <p className="text-[13px] text-muted">Copy it now. For safety, you won&apos;t see it again.</p>
        <div className="mt-4 break-all rounded-[16px] hairline-strong p-4 font-mono text-[14px]">{key}</div>
        <button onClick={() => { if (key) navigator.clipboard?.writeText(key); setKey(null); }} className="btn btn-solid mt-5 w-full">Copy and close</button>
      </Sheet>
    </main>
  );
}
