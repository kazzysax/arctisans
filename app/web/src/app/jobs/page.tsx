"use client";
import { ReceiveSheet, WithdrawSheet } from "@/components/WalletSheets";
import { useState, useEffect } from "react";
import Link from "next/link";
import { StateTag } from "@/components/JobState";
import { Empty } from "@/components/fun/Empty";
import { Roll } from "@/components/fun/Roll";
import { Stat } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";

const FILTERS = ["All", "Hiring", "Working", "Done"] as const;

type JobTerms = { client: string; artisan: string; title: string; deadline: number };
type ApiJob = { id: string; chainJobId: number | null; client: string; artisan: string; status: string; terms: JobTerms; createdAt: number };

const STATE_MAP: Record<string, string> = {
  Draft: "Proposed",
  Proposed: "Proposed",
  Accepted: "Funded",
  Funded: "Funded",
  Active: "Active",
  Delivered: "Delivered",
  Settlement: "Settlement",
  Completed: "Completed",
  Disputed: "Settlement",
  Cancelled: "Proposed",
};

function statusToTag(s: string): string {
  return STATE_MAP[s] ?? s;
}

function deadline(ts: number) {
  const d = new Date(ts * 1000);
  return d.toLocaleDateString("en-GB", { month: "short", day: "numeric" });
}

export default function Jobs() {
  const auth = useAuth();
  const myWallet = auth.status === "in" ? auth.profile.wallet : "";
  const [f, setF] = useState<(typeof FILTERS)[number]>("All");
  const [jobs, setJobs] = useState<ApiJob[] | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [sheet, setSheet] = useState<"in" | "out" | null>(null);
  const loadBalance = () => fetch("/api/wallet/balance", { credentials: "include" }).then((r) => r.ok ? r.json() : Promise.reject()).then((j: { balance: number }) => setBalance(j.balance)).catch(() => null);
  useEffect(() => { loadBalance(); }, []);

  useEffect(() => {
    fetch("/api/jobs", { credentials: "include" })
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((j: { items?: ApiJob[] }) => setJobs(j.items ?? []))
      .catch(() => setJobs([]));
  }, []);

  const list = (jobs ?? []).filter((j) => {
    const isClient = j.client === myWallet;
    const isArtisan = j.artisan === myWallet;
    const done = j.status === "Completed" || j.status === "Cancelled";
    if (f === "Done") return done;
    if (f === "Hiring") return isClient && !done;
    if (f === "Working") return isArtisan && !done;
    return true;
  });

  const openJobs = (jobs ?? []).filter((j) => j.status !== "Completed" && j.status !== "Cancelled");

  return (
    <div className="relative mx-auto min-h-dvh max-w-[560px] pb-32">
      <header className="px-5 pt-[max(18px,env(safe-area-inset-top))]">
        <h1 className="text-[28px] font-semibold tracking-[-0.04em]">Jobs</h1>
        <p className="mt-1 text-[14px] text-muted">Agreements, invoices and payments.</p>
      </header>

      {/* wallet card */}
      <div className="mx-5 mt-5 overflow-hidden rounded-[26px] hairline">
        <div className="relative p-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/demo/bg_leaf_blue.jpg" alt="" className="absolute inset-0 h-full w-full object-cover object-[center_90%]" />
          <div className="absolute inset-0 bg-gradient-to-r from-white/60 via-white/25 to-transparent" />
          <div className="relative text-[#0b1a29]">
            <div className="text-[11px] uppercase tracking-[0.2em] text-[#0b1a29]/60">Wallet · USDC on Arc</div>
            <div className="mt-2 text-[38px] font-semibold leading-none">
              {balance !== null ? <Roll value={balance / 1e6} prefix="$" decimals={2} /> : <span className="animate-pulse text-[#0b1a29]/40">—</span>}
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={() => setSheet("in")} className="press h-9 rounded-full bg-[#0b1a29] px-4 text-[13px] font-medium text-white">Add funds</button>
              <button onClick={() => setSheet("out")} className="press h-9 rounded-full border border-[#0b1a29]/30 bg-white/40 px-4 text-[13px] text-[#0b1a29] backdrop-blur">Withdraw</button>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 border-t border-line p-4">
          <Stat value={`${openJobs.length}`} label="Open" />
          <Stat value={`${list.filter((j) => j.status === "Completed").length}`} label="Done" />
          <Stat value="—" label="Tips" />
        </div>
      </div>

      <div className="no-scrollbar mt-6 flex gap-2 overflow-x-auto px-5">
        {FILTERS.map((x) => <button key={x} data-on={f === x} onClick={() => setF(x)} className="chip press">{x}</button>)}
      </div>

      <div className="mt-3 px-5">
        {jobs === null && (
          <div className="flex flex-col gap-4 mt-2">
            {[1, 2, 3].map((i) => <div key={i} className="h-20 animate-pulse rounded-[18px] bg-line" />)}
          </div>
        )}

        {jobs !== null && list.length === 0 && (
          <Empty art="thread" title="Nothing here yet" body="Jobs in this state will show up here." action={{ href: "/search", label: "Find a request" }} />
        )}

        {list.map((j, i) => {
          const isClient = j.client === myWallet;
          const other = isClient ? j.artisan : j.client;
          const shortAddr = other.slice(0, 6) + "…" + other.slice(-4);
          const tag = statusToTag(j.status);
          return (
            <Link key={j.id} href={`/jobs/${j.id}`} className={`press block py-4 ${i ? "border-t border-line" : ""}`}>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-bg-2 text-[11px] font-medium text-muted">{isClient ? "📋" : "🔨"}</div>
                <div className="min-w-0 flex-1 leading-tight">
                  <div className="truncate text-[15px] font-medium">{j.terms.title}</div>
                  <div className="mt-0.5 truncate text-[12.5px] text-muted">{shortAddr} · {isClient ? "You're hiring" : "You're working"} · due {deadline(j.terms.deadline)}</div>
                </div>
                <StateTag s={tag as "Proposed" | "Funded" | "Active" | "Delivered" | "Settlement" | "Completed"} />
              </div>
            </Link>
          );
        })}
      </div>
      {myWallet && <ReceiveSheet open={sheet === "in"} onClose={() => setSheet(null)} wallet={myWallet} />}
      <WithdrawSheet open={sheet === "out"} onClose={() => setSheet(null)} balance={balance} onDone={loadBalance} />
    </div>
  );
}
