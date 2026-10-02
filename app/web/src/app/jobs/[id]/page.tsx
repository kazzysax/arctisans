"use client";
import { use, useState } from "react";
import { notFound } from "next/navigation";
import { jobs, people } from "@/lib/demo";
import { TopBar, Sheet } from "@/components/ui";
import { StateTag } from "@/components/JobState";
import { PaidStamp } from "@/components/fun/PaidStamp";
import { Roll } from "@/components/fun/Roll";
import { Check, Plus } from "@/components/icons";

// Invoice: the agreed terms, a money timeline, and only the actions the rules allow right now.
export default function Invoice({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const j = jobs.find((x) => x.id === id);
  const [split, setSplit] = useState(false);
  const [pct, setPct] = useState(50);
  const [review, setReview] = useState(false);
  const [stars, setStars] = useState(5);
  const [state, setState] = useState(j?.state ?? "Proposed");
  const [released, setReleased] = useState(j?.released ?? 0);
  const [stamped, setStamped] = useState(false);
  const [deliver, setDeliver] = useState(false);
  const [update, setUpdate] = useState(false);
  const [offer, setOffer] = useState(false);
  if (!j) notFound();
  const client = people[j.client], art = people[j.artisan];
  const frozen = j.total - released;
  const upfront = j.state === "Completed" ? 0 : j.released;
  const done = state === "Completed";
  const approve = () => { setReview(false); setReleased(j.total); setState("Completed"); setStamped(true); };
  const steps = [
    ["Agreement accepted", "Oct 7", true], ["Funded into escrow", `$${j.total.toFixed(2)}`, j.state !== "Proposed"],
    ["Work started" + (upfront ? " · upfront released" : ""), upfront ? `$${upfront.toFixed(2)}` : "Paid on approval", j.state !== "Proposed" && j.state !== "Funded"], ["Delivered", "Waiting for approval", ["Delivered", "Completed"].includes(state)],
    ["Approved · rest released", `$${(j.total - upfront).toFixed(2)}`, state === "Completed"],
  ] as const;
  return (
    <main className="mx-auto min-h-dvh max-w-[560px] pb-36">
      <TopBar back="/jobs" title={`Invoice #${j.id}`} right={<StateTag s={state} />} />
      <div className="px-5">
        <div className="card relative mt-2 overflow-hidden" style={{ animation: stamped ? "thud 420ms ease 330ms" : undefined }}>
          {done && <div className="absolute bottom-[34px] right-3 z-10 scale-[.82]"><PaidStamp date={stamped ? "today" : "Oct 9"} animate={stamped} /></div>}
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
            <div><div className="label">Released</div><div className="mt-1 text-[20px] font-medium"><Roll value={released} prefix="$" decimals={2} /></div></div>
            <div><div className="label">In escrow</div><div className="mt-1 text-[20px] font-medium"><Roll value={frozen} prefix="$" decimals={2} /></div></div>
            <div className="col-span-2 mt-4 h-[3px] rounded-full bg-line"><div className="h-full rounded-full bg-fg transition-[width] duration-1000 ease-out" style={{ width: `${(released / j.total) * 100}%` }} /></div>
          </div>
        </div>

        {state === "Settlement" && (
          <div className="card mt-5 p-5">
            <div className="flex items-center justify-between"><div className="eyebrow">Settlement</div><Countdown hours={31} /></div>
            <p className="mt-3 text-[13.5px] leading-relaxed text-muted">{client.name.split(" ")[0]} offered a split of the ${frozen.toFixed(2)} in escrow. If nobody agrees before the timer ends, the rule you both chose applies: <span className="text-fg">50/50</span>.</p>
            <div className="mt-4 grid grid-cols-2 rounded-[18px] hairline">
              <div className="p-4"><div className="label">You get</div><div className="num mt-1 text-[22px] font-medium">${(frozen * 0.6).toFixed(2)}</div></div>
              <div className="border-l border-line p-4"><div className="label">Client gets back</div><div className="num mt-1 text-[22px] font-medium text-muted">${(frozen * 0.4).toFixed(2)}</div></div>
            </div>
            <div className="mt-4 flex gap-2"><button onClick={() => setSplit(true)} className="btn btn-ghost btn-sm flex-1">Counter</button><button onClick={() => setOffer(true)} className="btn btn-solid btn-sm flex-1">Accept 60/40</button></div>
          </div>
        )}

        {state !== "Proposed" && <>
        <h2 className="mt-8 text-[15px] font-medium">Updates</h2>
        <div className="mt-3 flex flex-col gap-3">
          {([["Oct 12", "Shared 2 directions. Going with the warmer one.", "/demo/work_callig.jpg"], ["Oct 10", "Started. Moodboard first.", null]] as const).map(([d, t, img]) => (
            <div key={d} className="flex gap-3 rounded-[18px] hairline p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {img && <img src={img} alt="" className="h-14 w-14 shrink-0 rounded-[12px] bg-[var(--img-bg)] object-cover" />}
              <div className="leading-snug"><div className="text-[13.5px]">{t}</div><div className="mt-1 text-[11.5px] text-faint">{d} · {art.name.split(" ")[0]} · resets the 3-day clock</div></div>
            </div>
          ))}
        </div></>}

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

      <div className="fixed bottom-0 left-[var(--rail)] right-[var(--aside)] z-40 flex justify-center bg-gradient-to-t from-[var(--bg)] via-[var(--bg)] to-transparent px-5 pb-[max(18px,env(safe-area-inset-bottom))] pt-8">
        <div className="flex w-full max-w-[440px] flex-col gap-2">
          {state === "Delivered" && <><button onClick={() => setReview(true)} className="btn btn-solid w-full">Approve · release ${frozen.toFixed(2)}</button>
            <div className="flex gap-2"><button className="btn btn-ghost btn-sm flex-1">Ask for revision</button><button onClick={() => setSplit(true)} className="btn btn-ghost btn-sm flex-1">Offer a split</button></div></>}
          {state === "Active" && <div className="flex gap-2"><button onClick={() => setUpdate(true)} className="btn btn-ghost flex-1">Post update</button><button onClick={() => setDeliver(true)} className="btn btn-solid flex-1">Deliver</button></div>}
          {state === "Proposed" && <div className="flex gap-2"><button className="btn btn-ghost">Decline</button><button className="btn btn-solid flex-1">Accept terms</button></div>}
          {done && !stamped && <button onClick={() => setReview(true)} className="btn btn-solid w-full">Leave a review</button>}
          {done && stamped && <div className="rise flex gap-2"><a href={`/api/og/u/${art.handle}`} className="btn btn-ghost flex-1">Share receipt</a><button onClick={() => setReview(true)} className="btn btn-solid flex-1">Leave a review</button></div>}
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
        <button onClick={state === "Delivered" ? approve : () => setReview(false)} className="btn btn-solid mt-5 w-full">{state === "Delivered" ? `Approve · release $${frozen.toFixed(2)}` : "Post review"}</button>
      </Sheet>
      <Sheet open={deliver} onClose={() => setDeliver(false)} title="Deliver the work">
        <p className="text-[13px] text-muted">Check it against what you agreed. The client has 3 days to approve, ask for a revision, or open settlement.</p>
        <div className="mt-4 rounded-[18px] hairline p-4 text-[13px]">
          <div className="label">Done means</div>
          {["Final files in the agreed format", "Everything in the deliverables list", "Within the revisions agreed"].map((d) => <div key={d} className="mt-2.5 flex items-center gap-2.5"><span className="grid h-5 w-5 place-items-center rounded-full bg-fg text-[var(--bg)]"><Check size={12} /></span>{d}</div>)}
        </div>
        <button className="mt-3 flex h-24 w-full flex-col items-center justify-center gap-1 rounded-[18px] border border-dashed border-line-strong text-[13px] text-muted"><Plus size={18} />Add files or pictures</button>
        <textarea rows={2} className="field mt-3" placeholder="A note for the client (optional)" />
        <button onClick={() => { setDeliver(false); setState("Delivered"); }} className="btn btn-solid mt-4 w-full">Deliver</button>
      </Sheet>

      <Sheet open={update} onClose={() => setUpdate(false)} title="Post an update">
        <textarea rows={3} className="field" placeholder="Where are you with the work?" />
        <button className="mt-3 flex h-20 w-full items-center justify-center gap-2 rounded-[18px] border border-dashed border-line-strong text-[13px] text-muted"><Plus size={16} />Add a picture</button>
        <p className="mt-3 text-[12px] text-faint">Each update resets the 3-day clock.</p>
        <button onClick={() => setUpdate(false)} className="btn btn-solid mt-4 w-full">Post update</button>
      </Sheet>

      <Sheet open={offer} onClose={() => setOffer(false)} title="Accept 60/40?">
        <p className="text-[13.5px] leading-relaxed text-muted">You get ${(frozen * 0.6).toFixed(2)} now, and {client.name.split(" ")[0]} gets ${(frozen * 0.4).toFixed(2)} back. The job closes and this is final.</p>
        <button onClick={() => { setOffer(false); setReleased(j.total); setState("Completed"); setStamped(true); }} className="btn btn-solid mt-6 w-full">Accept and close</button>
      </Sheet>
    </main>
  );
}

function Countdown({ hours }: { hours: number }) {
  return (
    <div className="flex items-center gap-2">
      <svg width="22" height="22" viewBox="0 0 36 36" className="-rotate-90" aria-hidden>
        <circle cx="18" cy="18" r="15" fill="none" stroke="var(--line)" strokeWidth="3" />
        <circle cx="18" cy="18" r="15" fill="none" stroke="var(--fg)" strokeWidth="3" strokeLinecap="round" strokeDasharray={94.2} strokeDashoffset={94.2 * (1 - hours / 48)} />
      </svg>
      <span className="num text-[12.5px]">{hours}h left</span>
    </div>
  );
}
