"use client";
import { use, useState } from "react";
import { notFound } from "next/navigation";
import { jobs, people } from "@/lib/demo";
import { TopBar, Sheet } from "@/components/ui";
import { StateTag } from "@/components/JobState";

// Invoice: the agreed terms, a money timeline, and only the actions the rules allow right now.
export default function Invoice({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const j = jobs.find((x) => x.id === id);
  const [split, setSplit] = useState(false);
  const [pct, setPct] = useState(50);
  const [review, setReview] = useState(false);
  const [stars, setStars] = useState(5);
  if (!j) notFound();
  const client = people[j.client], art = people[j.artisan];
  const frozen = j.total - j.released;
  const upfront = j.state === "Completed" ? 0 : j.released;
  const steps = [
    ["Agreement accepted", "Oct 7", true], ["Funded into escrow", `$${j.total.toFixed(2)}`, j.state !== "Proposed"],
    ["Work started" + (upfront ? " · upfront released" : ""), upfront ? `$${upfront.toFixed(2)}` : "Paid on approval", j.state !== "Proposed" && j.state !== "Funded"], ["Delivered", "Waiting for approval", j.state === "Delivered" || j.state === "Completed"],
    ["Approved · rest released", `$${(j.total - upfront).toFixed(2)}`, j.state === "Completed"],
  ] as const;
  return (
    <main className="mx-auto min-h-dvh max-w-[480px] pb-36">
      <TopBar back="/jobs" title={`Invoice #${j.id}`} right={<StateTag s={j.state} />} />
      <div className="px-5">
        <div className="card mt-2 overflow-hidden">
          <div className="p-5">
            <div className="eyebrow">{j.title}</div>
            <div className="num mt-3 text-[44px] font-semibold leading-none">${j.total.toFixed(2)}</div>
            <div className="mt-2 text-[13px] text-muted">{j.split} · due {j.deadline} · {j.revisions}</div>
          </div>
          <div className="rule" />
          <div className="grid grid-cols-2">
            {[["Client", client], ["Arctisan", art]].map(([k, p], i) => {
              const pp = p as typeof client;
              return (
                <div key={String(k)} className={`flex items-center gap-3 p-4 ${i ? "border-l border-line" : ""}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={pp.avatar} alt="" className="h-9 w-9 rounded-[12px] object-cover" />
                  <div className="min-w-0 leading-tight"><div className="label">{String(k)}</div><div className="mt-1 truncate text-[13.5px]">{pp.name}</div></div>
                </div>
              );
            })}
          </div>
          <div className="rule" />
          <div className="grid grid-cols-2 p-5">
            <div><div className="label">Released</div><div className="num mt-1 text-[20px] font-medium">${j.released.toFixed(2)}</div></div>
            <div><div className="label">In escrow</div><div className="num mt-1 text-[20px] font-medium">${frozen.toFixed(2)}</div></div>
            <div className="col-span-2 mt-4 h-[3px] rounded-full bg-line"><div className="h-full rounded-full bg-fg" style={{ width: `${(j.released / j.total) * 100}%` }} /></div>
          </div>
        </div>

        <h2 className="mt-8 text-[15px] font-medium">Timeline</h2>
        <ol className="mt-4">
          {steps.map(([t, d, ok], i) => (
            <li key={i} className="relative flex gap-4 pb-5 last:pb-0">
              {i < steps.length - 1 && <span className={`absolute left-[7px] top-5 h-[calc(100%-12px)] w-px ${ok ? "bg-fg" : "bg-line"}`} />}
              <span className={`mt-1 h-[15px] w-[15px] shrink-0 rounded-full border ${ok ? "border-fg bg-fg" : "border-line-strong"}`} />
              <div className="leading-tight"><div className={`text-[14px] ${ok ? "" : "text-muted"}`}>{t}</div><div className="mt-1 text-[12px] text-faint">{d}</div></div>
            </li>
          ))}
        </ol>

        <h2 className="mt-8 text-[15px] font-medium">Rules you both agreed</h2>
        <div className="mt-3 flex flex-col gap-2 text-[13px] leading-relaxed text-muted">
          <p>· 3 days with no update from the Arctisan: unreleased money returns to the client.</p>
          <p>· 3 days with no reply to a delivery: it moves to settlement.</p>
          <p>· No split agreed in 48 hours: the frozen part is shared 50/50.</p>
        </div>
        <a href="#" className="mt-5 inline-block text-[12.5px] text-muted underline underline-offset-4">Terms fingerprint 0x7c3a…e19f · View on Arc</a>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 flex justify-center bg-gradient-to-t from-[var(--bg)] via-[var(--bg)] to-transparent px-5 pb-[max(18px,env(safe-area-inset-bottom))] pt-8">
        <div className="flex w-full max-w-[440px] flex-col gap-2">
          {j.state === "Delivered" && <><button onClick={() => setReview(true)} className="btn btn-solid w-full">Approve · release ${frozen.toFixed(2)}</button>
            <div className="flex gap-2"><button className="btn btn-ghost btn-sm flex-1">Ask for revision</button><button onClick={() => setSplit(true)} className="btn btn-ghost btn-sm flex-1">Offer a split</button></div></>}
          {j.state === "Active" && <div className="flex gap-2"><button className="btn btn-ghost flex-1">Post update</button><button className="btn btn-solid flex-1">Mark delivered</button></div>}
          {j.state === "Proposed" && <div className="flex gap-2"><button className="btn btn-ghost">Decline</button><button className="btn btn-solid flex-1">Accept terms</button></div>}
          {j.state === "Completed" && <button onClick={() => setReview(true)} className="btn btn-solid w-full">Leave a review</button>}
        </div>
      </div>

      <Sheet open={split} onClose={() => setSplit(false)} title="Offer a split">
        <p className="text-[13px] text-muted">Of the ${frozen.toFixed(2)} still in escrow. The other side can accept or counter.</p>
        <div className="mt-6 flex items-end justify-between">
          <div><div className="label">{art.name.split(" ")[0]} gets</div><div className="num mt-1 text-[30px] font-semibold">${(frozen * pct / 100).toFixed(2)}</div></div>
          <div className="text-right"><div className="label">You get back</div><div className="num mt-1 text-[30px] font-semibold text-muted">${(frozen * (100 - pct) / 100).toFixed(2)}</div></div>
        </div>
        <input type="range" min={0} max={100} step={5} value={pct} onChange={(e) => setPct(Number(e.target.value))} className="mt-5 w-full accent-[var(--fg)]" aria-label="Split" />
        <button onClick={() => setSplit(false)} className="btn btn-solid mt-6 w-full">Send offer · {pct}/{100 - pct}</button>
      </Sheet>

      <Sheet open={review} onClose={() => setReview(false)} title={`Review ${art.name.split(" ")[0]}`}>
        <div className="flex gap-2">{[1, 2, 3, 4, 5].map((n) => <button key={n} onClick={() => setStars(n)} aria-label={`${n} stars`} className={`press text-[34px] leading-none ${n <= stars ? "text-fg" : "text-line-strong"}`}>★</button>)}</div>
        <textarea rows={3} className="field mt-5" placeholder="What was it like to work together?" />
        <p className="mt-2 text-[12px] text-faint">Reviews are tied to this paid job and stored on Arc.</p>
        <button onClick={() => setReview(false)} className="btn btn-solid mt-5 w-full">{j.state === "Delivered" ? `Approve and post` : "Post review"}</button>
      </Sheet>
    </main>
  );
}
