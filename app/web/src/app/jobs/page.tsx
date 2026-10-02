"use client";
import { useState } from "react";
import Link from "next/link";
import { jobs, people } from "@/lib/demo";
import { StateTag } from "@/components/JobState";
import { Empty } from "@/components/fun/Empty";
import { Roll } from "@/components/fun/Roll";
import { Stat } from "@/components/ui";

const ME = "amara";
const FILTERS = ["All", "Hiring", "Working", "Done"] as const;

export default function Jobs() {
  const [f, setF] = useState<(typeof FILTERS)[number]>("All");
  const list = jobs.filter((j) =>
    f === "All" ? true : f === "Done" ? j.state === "Completed" : f === "Hiring" ? j.client === ME && j.state !== "Completed" : j.artisan === ME && j.state !== "Completed");
  const escrow = jobs.filter((j) => j.state !== "Completed").reduce((a, j) => a + j.total - j.released, 0);
  return (
    <div className="relative mx-auto min-h-dvh max-w-[560px] pb-24">
      <header className="px-5 pt-[max(18px,env(safe-area-inset-top))]">
        <h1 className="text-[28px] font-semibold tracking-[-0.04em]">Jobs</h1>
        <p className="mt-1 text-[14px] text-muted">Agreements, invoices and payments.</p>
      </header>

      {/* wallet card */}
      <div className="mx-5 mt-5 overflow-hidden rounded-[26px] hairline">
        <div className="relative p-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/demo/bg_blue.jpg" alt="" className="absolute inset-0 h-full w-full object-cover opacity-90" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/40 to-black/10" />
          <div className="relative text-white">
            <div className="text-[11px] uppercase tracking-[0.2em] text-white/60">Wallet · USDC on Arc</div>
            <div className="mt-2 text-[38px] font-semibold leading-none"><Roll value={1284.5} prefix="$" decimals={2} /></div>
            <div className="mt-4 flex gap-2">
              <button className="press h-9 rounded-full bg-white px-4 text-[13px] font-medium text-black">Add funds</button>
              <button className="press h-9 rounded-full border border-white/30 px-4 text-[13px] text-white backdrop-blur">Withdraw</button>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 border-t border-line p-4">
          <Stat value={`$${escrow.toFixed(0)}`} label="In escrow" />
          <Stat value={jobs.filter((j) => j.state !== "Completed").length} label="Open" />
          <Stat value="$186" label="Tips" />
        </div>
      </div>

      <div className="no-scrollbar mt-6 flex gap-2 overflow-x-auto px-5">
        {FILTERS.map((x) => <button key={x} data-on={f === x} onClick={() => setF(x)} className="chip press">{x}</button>)}
      </div>

      <div className="mt-3 px-5">
        {list.length === 0 && <Empty art="thread" title="Nothing here yet" body="Jobs in this state will show up here." action={{ href: "/search", label: "Find a request" }} />}
        {list.map((j, i) => {
          const other = people[j.client === ME ? j.artisan : j.client] ?? people[j.artisan];
          const pct = (j.released / j.total) * 100;
          return (
            <Link key={j.id} href={`/jobs/${j.id}`} className={`press block py-4 ${i ? "border-t border-line" : ""}`}>
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={other.avatar} alt="" className="h-11 w-11 rounded-[14px] object-cover" />
                <div className="min-w-0 flex-1 leading-tight">
                  <div className="truncate text-[15px] font-medium">{j.title}</div>
                  <div className="mt-0.5 truncate text-[12.5px] text-muted">{other.name} · #{j.id} · due {j.deadline}</div>
                </div>
                <div className="num text-right text-[16px] font-medium">${j.total}</div>
              </div>
              <div className="mt-3 flex items-center gap-3 pl-14">
                <div className="h-[3px] flex-1 rounded-full bg-line"><div className="h-full rounded-full bg-fg transition-all" style={{ width: `${pct}%` }} /></div>
                <StateTag s={j.state} />
              </div>
              <div className="mt-2 pl-14 text-[12px] text-faint">{j.next}</div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
