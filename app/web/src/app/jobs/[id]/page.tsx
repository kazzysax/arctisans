"use client";
import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { TopBar, Sheet } from "@/components/ui";
import { StateTag } from "@/components/JobState";
import { PaidStamp } from "@/components/fun/PaidStamp";
import { PaidCelebration } from "@/components/fun/PaidCelebration";
import { Roll } from "@/components/fun/Roll";
import { JobChat } from "@/components/JobChat";
import { Check, Plus } from "@/components/icons";
import { sendCalls, circleReady, type Call } from "@/lib/walletClient";
import type { JobState } from "@/lib/demo";

type Party = { wallet: string; handle: string | null; name: string; avatar: string | null };
type Job = {
  id: string; chainJobId: number | null; status: string; termsHash: string; me: "client" | "artisan"; total: number; released: number;
  client: Party; artisan: Party; deadlockAt: number | null;
  splitOffer: { by: string; toArtisan: number; toClient: number } | null;
  timeline: { event: string; tx: string; ts: number | null }[];
  terms: { title: string; deliverables: string[]; doneMeans: string; revisions: number; deadline: number; upfront: number; milestones: number[]; deadlockRule: string };
};
const usd = (u: number) => u / 1e6;
const money = (u: number) => `$${usd(u).toFixed(2)}`;
const TAG: Record<string, JobState> = { Draft: "Proposed", Proposed: "Proposed", Agreed: "Funded", Funded: "Funded", Active: "Active", Delivered: "Delivered", Settlement: "Settlement", Completed: "Completed", Settled: "Completed", Deadlocked: "Completed", Cancelled: "Completed", Abandoned: "Completed" };
const RULE = { Split5050: "shared 50/50", ToClient: "returned to the client", ToArtisan: "paid to the artisan" } as const;
const when = (ts: number | null) => (ts ? new Date(ts * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "");

// Invoice: the agreed terms, a money timeline from onchain events, and only the actions the rules allow right now.
export default function Invoice({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [j, setJ] = useState<Job | null>(null);
  const [gone, setGone] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [stamped, setStamped] = useState(false);
  const [sheet, setSheet] = useState<null | "split" | "review" | "deliver" | "update" | "accept" | "revise">(null);
  const [pct, setPct] = useState(50);
  const [stars, setStars] = useState(5);
  const [note, setNote] = useState("");
  const [now] = useState(() => Date.now());
  const [party, setParty] = useState(false);
  // The Arctisan sees "You got paid!" once, the first time they open a job that has paid out.
  useEffect(() => {
    if (!j || j.me !== "artisan" || j.released <= 0 || !["Completed", "Settled"].includes(j.status)) return;
    const k = `arc_paid_${j.id}`;
    if (localStorage.getItem(k)) return;
    localStorage.setItem(k, "1");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time celebration when a payout is first seen
    setParty(true);
  }, [j]);

  const load = useCallback(async () => {
    const r = await fetch(`/api/jobs/${id}`, { credentials: "include" });
    if (r.status === 401) { location.href = "/signup"; return null; }
    if (!r.ok) { setGone(true); return null; }
    const d = (await r.json()) as Job; setJ(d); return d;
  }, [id]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount: state is set when the request resolves
  useEffect(() => { void load(); }, [load]);
  // While something is in flight onchain, quietly re-check every few seconds until it lands.
  useEffect(() => { if (!j || j.chainJobId != null) return; const t = setInterval(() => void load(), 4000); return () => clearInterval(t); }, [j, load]);

  async function act(label: string, body: Record<string, unknown>, after?: (d: Job) => void) {
    setErr(null); setBusy(label);
    try {
      const r = await fetch(`/api/jobs/${id}`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const x = await r.json();
      if (!r.ok) throw new Error(x.error ?? "That didn't work");
      if (!circleReady()) throw new Error("Wallet is not connected yet");
      await sendCalls(x.calls as Call[]);
      const d = await load();
      if (d && after) after(d);
      setSheet(null); setNote("");
    } catch (e) { setErr((e as Error).message); } finally { setBusy(null); }
  }

  if (gone) return <main className="mx-auto flex min-h-dvh max-w-[560px] flex-col items-center justify-center px-6 text-center"><h1 className="text-[22px] font-semibold">We couldn&apos;t find that invoice</h1><Link href="/jobs" className="btn btn-ghost mt-6">Back to jobs</Link></main>;
  if (!j) return <main className="mx-auto min-h-dvh max-w-[560px] px-5 pt-24"><div className="skeleton h-56 rounded-[24px]" /><div className="skeleton mt-4 h-32 rounded-[24px]" /></main>;

  const s = j.status, tag = TAG[s] ?? "Proposed";
  const isClient = j.me === "client", other = isClient ? j.artisan : j.client, mine = isClient ? j.client : j.artisan;
  const frozen = Math.max(0, j.total - j.released);
  const done = ["Completed", "Settled", "Deadlocked"].includes(s);
  const offerFromOther = !!j.splitOffer && j.splitOffer.by !== mine.wallet.toLowerCase();
  const has = (e: string) => j.timeline.some((t) => t.event === e), at = (e: string) => when(j.timeline.find((t) => t.event === e)?.ts ?? null);
  const steps = [
    ["Agreement accepted", at("TermsAgreed"), has("TermsAgreed")],
    ["Funded into escrow", has("JobFunded") ? money(j.total) : "", has("JobFunded")],
    ["Work started" + (j.terms.upfront ? " · upfront released" : ""), j.terms.upfront ? money(j.terms.upfront) : "Paid on approval", has("JobStarted")],
    ["Delivered", has("Delivered") ? at("Delivered") : "Waiting for delivery", has("Delivered")],
    ["Approved · rest released", done ? money(j.released) : "", done],
  ] as const;
  const dueIn = j.deadlockAt ? Math.max(0, Math.ceil((j.deadlockAt * 1000 - now) / 36e5)) : null;
  const first = (p: Party) => p.name.split(" ")[0];
  const ready = j.chainJobId != null;

  return (
    <main className="mx-auto min-h-dvh max-w-[560px] pb-40">
      <TopBar back="/jobs" title={`Invoice #${j.chainJobId ?? "…"}`} right={<StateTag s={tag} />} />
      <div className="px-5">
        <div className="card relative mt-2 overflow-hidden" style={{ animation: stamped ? "thud 420ms ease 330ms" : undefined }}>
          {done && <div className="absolute bottom-[34px] right-3 z-10 scale-[.82]"><PaidStamp date={stamped ? "today" : at("JobClosed")} animate={stamped} /></div>}
          <div className="p-5">
            <div className="eyebrow">{j.terms.title}</div>
            <div className="num mt-3 text-[44px] font-semibold leading-none">{money(j.total)}</div>
            <div className="mt-2 text-[13px] text-muted">due {when(j.terms.deadline)} · {j.terms.revisions} revision{j.terms.revisions === 1 ? "" : "s"}</div>
          </div>
          <div className="rule" />
          <div className="grid grid-cols-2">
            {([["Client", j.client], ["Arctisan", j.artisan]] as const).map(([k, pp], i) => (
              <Link key={k} href={pp.handle ? `/u/${pp.handle}` : "#"} className={`flex items-center gap-3 p-4 ${i ? "border-l border-line" : ""}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={pp.avatar ?? "/demo/av_5.jpg"} alt="" className="h-9 w-9 rounded-[12px] object-cover" />
                <div className="min-w-0 leading-tight"><div className="label">{k}{pp.wallet === mine.wallet ? " · you" : ""}</div><div className="mt-1 truncate text-[13.5px]">{pp.name}</div></div>
              </Link>
            ))}
          </div>
          <div className="rule" />
          <div className="grid grid-cols-2 p-5">
            <div><div className="label">Released</div><div className="mt-1 text-[20px] font-medium"><Roll value={usd(j.released)} prefix="$" decimals={2} /></div></div>
            <div><div className="label">In escrow</div><div className="mt-1 text-[20px] font-medium"><Roll value={usd(frozen)} prefix="$" decimals={2} /></div></div>
            <div className="col-span-2 mt-4 h-[3px] rounded-full bg-line"><div className="h-full rounded-full bg-fg transition-[width] duration-1000 ease-out" style={{ width: `${j.total ? (j.released / j.total) * 100 : 0}%` }} /></div>
          </div>
        </div>

        {s === "Settlement" && (
          <div className="card mt-5 p-5">
            <div className="flex items-center justify-between"><div className="eyebrow">Settlement</div>{dueIn != null && <Countdown hours={dueIn} />}</div>
            {offerFromOther && j.splitOffer ? (
              <>
                <p className="mt-3 text-[13.5px] leading-relaxed text-muted">{first(other)} offered a split of the {money(frozen)} in escrow. If nobody agrees in time, the rule you both chose applies: <span className="text-fg">{RULE[j.terms.deadlockRule as keyof typeof RULE]}</span>.</p>
                <div className="mt-4 grid grid-cols-2 rounded-[18px] hairline">
                  <div className="p-4"><div className="label">{first(j.artisan)} gets</div><div className="num mt-1 text-[22px] font-medium">{money(j.splitOffer.toArtisan)}</div></div>
                  <div className="border-l border-line p-4"><div className="label">{first(j.client)} gets back</div><div className="num mt-1 text-[22px] font-medium text-muted">{money(j.splitOffer.toClient)}</div></div>
                </div>
                <div className="mt-4 flex gap-2"><button onClick={() => setSheet("split")} className="btn btn-ghost btn-sm flex-1">Counter</button><button onClick={() => setSheet("accept")} className="btn btn-solid btn-sm flex-1">Accept</button></div>
              </>
            ) : (
              <>
                <p className="mt-3 text-[13.5px] leading-relaxed text-muted">{j.splitOffer ? `You offered a split. Waiting for ${first(other)}.` : "Offer a split of the money still in escrow."} If nobody agrees in time, it is <span className="text-fg">{RULE[j.terms.deadlockRule as keyof typeof RULE]}</span>.</p>
                <button onClick={() => setSheet("split")} className="btn btn-ghost btn-sm mt-4 w-full">{j.splitOffer ? "Change my offer" : "Offer a split"}</button>
              </>
            )}
          </div>
        )}

        <h2 className="mt-8 text-[15px] font-medium">Agreed</h2>
        <dl className="mt-2 text-[14px]">
          {[["Deliverables", j.terms.deliverables.join(" · ")], ["Done means", j.terms.doneMeans]].map(([k, v], i) => (
            <div key={k} className={`flex gap-4 py-3 ${i ? "border-t border-line" : ""}`}><dt className="w-28 shrink-0 text-muted">{k}</dt><dd className="flex-1">{v}</dd></div>
          ))}
        </dl>

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

        {j.chainJobId != null && <JobChat jobId={j.id} otherName={first(isClient ? j.artisan : j.client)} />}

        <h2 className="mt-8 text-[15px] font-medium">Rules you both agreed</h2>
        <div className="mt-3 flex flex-col gap-2 text-[13px] leading-relaxed text-muted">
          <p>· 3 days with no update from the Arctisan: unreleased money returns to the client.</p>
          <p>· 3 days with no reply to a delivery: it moves to settlement.</p>
          <p>· No split agreed in 48 hours: the frozen part is {RULE[j.terms.deadlockRule as keyof typeof RULE]}.</p>
        </div>
        <p className="mt-5 text-[12.5px] text-muted">Terms fingerprint <span className="font-mono">{j.termsHash.slice(0, 8)}…{j.termsHash.slice(-4)}</span>{j.timeline[0] && <> · <a className="underline underline-offset-4" target="_blank" rel="noreferrer" href={`https://explorer.arc.io/tx/${j.timeline[0].tx}`}>View on Arc</a></>}</p>
      </div>

      <div className="fixed bottom-0 left-[var(--rail)] right-[var(--aside)] z-40 flex justify-center bg-gradient-to-t from-[var(--bg)] via-[var(--bg)] to-transparent px-5 pb-[max(18px,env(safe-area-inset-bottom))] pt-8">
        <div className="flex w-full max-w-[440px] flex-col gap-2">
          {err && <p className="rounded-[14px] hairline bg-[var(--bg)] px-4 py-2.5 text-[13px]">{err}</p>}
          {!ready && !done && <p className="text-center text-[13px] text-muted">Confirming on Arc…</p>}
          {ready && s === "Proposed" && (isClient
            ? <p className="text-center text-[13px] text-muted">Waiting for {first(j.artisan)} to accept the terms.</p>
            : <div className="flex gap-2"><button disabled={!!busy} onClick={() => act("cancel", { action: "cancel" })} className="btn btn-ghost">Decline</button><button disabled={!!busy} onClick={() => act("agree", { action: "agree" })} className="btn btn-solid flex-1">{busy === "agree" ? "Waiting for approval…" : "Accept terms"}</button></div>)}
          {ready && s === "Agreed" && (isClient
            ? <button disabled={!!busy} onClick={() => act("fund", { action: "fund" })} className="btn btn-solid w-full">{busy === "fund" ? "Waiting for approval…" : `Fund ${money(j.total)} into escrow`}</button>
            : <p className="text-center text-[13px] text-muted">Waiting for {first(j.client)} to fund the escrow.</p>)}
          {ready && s === "Funded" && (isClient
            ? <p className="text-center text-[13px] text-muted">Funded. {first(j.artisan)} can start whenever ready.</p>
            : <button disabled={!!busy} onClick={() => act("start", { action: "start" })} className="btn btn-solid w-full">{busy === "start" ? "Waiting for approval…" : "Start work"}</button>)}
          {ready && s === "Active" && (isClient
            ? <div className="flex gap-2"><button onClick={() => setSheet("split")} className="btn btn-ghost flex-1">Open settlement</button></div>
            : <div className="flex gap-2"><button onClick={() => setSheet("update")} className="btn btn-ghost flex-1">Post update</button><button onClick={() => setSheet("deliver")} className="btn btn-solid flex-1">Deliver</button></div>)}
          {ready && s === "Delivered" && (isClient
            ? <><button disabled={!!busy} onClick={() => setSheet("review")} className="btn btn-solid w-full">Approve · release {money(frozen)}</button>
                <div className="flex gap-2"><button onClick={() => setSheet("revise")} className="btn btn-ghost btn-sm flex-1">Ask for revision</button><button onClick={() => setSheet("split")} className="btn btn-ghost btn-sm flex-1">Offer a split</button></div></>
            : <p className="text-center text-[13px] text-muted">Delivered. Waiting for {first(j.client)} to approve.</p>)}
          {done && <div className="flex gap-2">{stamped && <Link href={`/u/${other.handle ?? ""}`} className="btn btn-ghost flex-1">See {first(other)}</Link>}<button onClick={() => setSheet("review")} className="btn btn-solid flex-1">Leave a review</button></div>}
        </div>
      </div>

      <Sheet open={sheet === "split"} onClose={() => setSheet(null)} title={s === "Settlement" ? "Offer a split" : "Open settlement"}>
        <p className="text-[13px] text-muted">{s === "Settlement" ? "Of the" : "This pauses the job and lets you both agree how to share the"} {money(frozen)} still in escrow. The other side can accept or counter.</p>
        <div className="mt-6 flex items-end justify-between">
          <div><div className="label">{first(j.artisan)} gets</div><div className="num mt-1 text-[30px] font-semibold">${(usd(frozen) * pct / 100).toFixed(2)}</div></div>
          <div className="text-right"><div className="label">{first(j.client)} gets back</div><div className="num mt-1 text-[30px] font-semibold text-muted">${(usd(frozen) * (100 - pct) / 100).toFixed(2)}</div></div>
        </div>
        <input type="range" min={0} max={100} step={5} value={pct} onChange={(e) => setPct(Number(e.target.value))} className="mt-5 w-full accent-[var(--fg)]" aria-label="Split" />
        {err && <p className="mt-3 text-[13px]">{err}</p>}
        <button disabled={!!busy} onClick={async () => {
          const toArtisan = Math.round((frozen * pct) / 100);
          if (s !== "Settlement") { await act("open", { action: "openSettlement" }); }
          await act("offer", { action: "offerSplit", toArtisan });
        }} className="btn btn-solid mt-6 w-full">{busy ? "Waiting for approval…" : `Send offer · ${pct}/${100 - pct}`}</button>
      </Sheet>

      <Sheet open={sheet === "accept"} onClose={() => setSheet(null)} title="Accept this split?">
        <p className="text-[13.5px] leading-relaxed text-muted">{j.splitOffer ? `${first(j.artisan)} gets ${money(j.splitOffer.toArtisan)} and ${first(j.client)} gets ${money(j.splitOffer.toClient)} back. ` : ""}The job closes and this is final.</p>
        {err && <p className="mt-3 text-[13px]">{err}</p>}
        <button disabled={!!busy || !j.splitOffer} onClick={() => j.splitOffer && act("accept", { action: "acceptSplit", toArtisan: j.splitOffer.toArtisan }, () => setStamped(true))} className="btn btn-solid mt-6 w-full">{busy ? "Waiting for approval…" : "Accept and close"}</button>
      </Sheet>

      <Sheet open={sheet === "review"} onClose={() => setSheet(null)} title={s === "Delivered" ? `Approve and review ${first(other)}` : `Review ${first(other)}`}>
        <div className="flex gap-2">{[1, 2, 3, 4, 5].map((n) => <button key={n} onClick={() => setStars(n)} aria-label={`${n} stars`} className={`press text-[34px] leading-none ${n <= stars ? "text-fg" : "text-line-strong"}`}>★</button>)}</div>
        <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} className="field mt-5" placeholder="What was it like to work together?" />
        <p className="mt-2 text-[12px] text-faint">Reviews are tied to this paid job and stored on Arc.</p>
        {err && <p className="mt-3 text-[13px]">{err}</p>}
        <button disabled={!!busy} onClick={async () => {
          if (s === "Delivered") await act("approve", { action: "approveDelivery" }, (d) => { if (["Completed", "Settled"].includes(d.status)) setStamped(true); });
          await act("review", { action: "review", rating: stars, body: note });
        }} className="btn btn-solid mt-5 w-full">{busy ? "Waiting for approval…" : s === "Delivered" ? `Approve · release ${money(frozen)}` : "Post review"}</button>
      </Sheet>

      <Sheet open={sheet === "deliver"} onClose={() => setSheet(null)} title="Deliver the work">
        <p className="text-[13px] text-muted">Check it against what you agreed. The client has 3 days to approve, ask for a revision, or open settlement.</p>
        <div className="mt-4 rounded-[18px] hairline p-4 text-[13px]">
          <div className="label">Done means</div>
          <div className="mt-2.5 flex items-start gap-2.5"><span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-fg text-[var(--bg)]"><Check size={12} /></span>{j.terms.doneMeans}</div>
        </div>
        <button className="mt-3 flex h-24 w-full flex-col items-center justify-center gap-1 rounded-[18px] border border-dashed border-line-strong text-[13px] text-muted"><Plus size={18} />Add files or pictures</button>
        <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} className="field mt-3" placeholder="A note for the client (optional)" />
        {err && <p className="mt-3 text-[13px]">{err}</p>}
        <button disabled={!!busy} onClick={() => act("deliver", { action: "deliver", note })} className="btn btn-solid mt-4 w-full">{busy ? "Waiting for approval…" : "Deliver"}</button>
      </Sheet>

      {party && <PaidCelebration amount={money(j.released)} from={j.client.handle ? `@${j.client.handle}` : j.client.name} title={j.terms.title}
        onKudos={() => { setParty(false); setSheet("review"); }} onClose={() => setParty(false)} />}

      <Sheet open={sheet === "update"} onClose={() => setSheet(null)} title="Post an update">
        <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} className="field" placeholder="Where are you with the work?" />
        <p className="mt-3 text-[12px] text-faint">Each update resets the 3-day clock.</p>
        {err && <p className="mt-3 text-[13px]">{err}</p>}
        <button disabled={!!busy || !note.trim()} onClick={() => act("update", { action: "postProgress", note })} className="btn btn-solid mt-4 w-full">{busy ? "Waiting for approval…" : "Post update"}</button>
      </Sheet>

      <Sheet open={sheet === "revise"} onClose={() => setSheet(null)} title="Ask for a revision">
        <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} className="field" placeholder="What should change?" />
        {err && <p className="mt-3 text-[13px]">{err}</p>}
        <button disabled={!!busy || !note.trim()} onClick={() => act("revise", { action: "requestRevision", note })} className="btn btn-solid mt-4 w-full">{busy ? "Waiting for approval…" : "Send request"}</button>
      </Sheet>
    </main>
  );
}

function Countdown({ hours }: { hours: number }) {
  return (
    <div className="flex items-center gap-2">
      <svg width="22" height="22" viewBox="0 0 36 36" className="-rotate-90" aria-hidden>
        <circle cx="18" cy="18" r="15" fill="none" stroke="var(--line)" strokeWidth="3" />
        <circle cx="18" cy="18" r="15" fill="none" stroke="var(--fg)" strokeWidth="3" strokeLinecap="round" strokeDasharray={94.2} strokeDashoffset={94.2 * (1 - Math.min(1, hours / 48))} />
      </svg>
      <span className="num text-[12.5px]">{hours}h left</span>
    </div>
  );
}
