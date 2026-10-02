"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { sendCalls, circleReady, type Call } from "@/lib/walletClient";
import { TopBar } from "@/components/ui";
import { Check, Plus } from "@/components/icons";

// Agreement builder. Both sides agree these rules BEFORE any money moves; they are fingerprinted onchain.
type Plan = "upfront" | "full" | "milestones";
const RULES = [
  { id: "Split5050", t: "Split 50/50", d: "The frozen part is shared equally" },
  { id: "ToClient", t: "Back to client", d: "Safer for the client" },
  { id: "ToArtisan", t: "To the artisan", d: "For trusted, repeat work" },
] as const;

export default function Hire({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = use(params);
  const r = useRouter();
  type Who = { wallet: string; name: string; avatar: string; title: string; jobs: number; rating: string; level: { name: string; upfrontPct: number } };
  const [p, setP] = useState<Who | null>(null);
  const [missing, setMissing] = useState(false);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    fetch(`/api/u/${encodeURIComponent(handle)}`).then((x) => (x.ok ? x.json() : Promise.reject()))
      .then((d) => { if (live) setP({ wallet: d.profile.wallet, name: d.profile.displayName, avatar: d.profile.avatar ?? "/demo/av_5.jpg", title: d.profile.title ?? "", jobs: d.reputation?.completed ?? 0, rating: d.reputation?.ratingAvg ? Number(d.reputation.ratingAvg).toFixed(1) : "–", level: d.level }); })
      .catch(() => live && setMissing(true));
    return () => { live = false; };
  }, [handle]);
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState("");
  const [deliv, setDeliv] = useState([""]);
  const [done, setDone] = useState("");
  const [total, setTotal] = useState("");
  const [plan, setPlan] = useState<Plan>("full");
  const [ms, setMs] = useState(["30", "30", "25"]);
  const [rev, setRev] = useState(1);
  const [days, setDays] = useState(7);
  const [now] = useState(() => Date.now());
  const [rule, setRule] = useState<(typeof RULES)[number]["id"]>("Split5050");
  const level = p?.level ?? { name: "New", upfrontPct: 0 };
  const canUpfront = level.upfrontPct > 0;
  const t = Number(total) || 0;
  const over = t > 100, under = t < 1;
  const msSum = ms.reduce((a, b) => a + (Number(b) || 0), 0);
  const msOk = plan !== "milestones" || Math.abs(msSum - t) < 0.001;
  const deadline = new Date(now + days * 864e5).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const up = (t * level.upfrontPct) / 100;
  const schedule = plan === "upfront" ? [[`When work starts (${level.upfrontPct}%)`, up], ["When you approve", t - up]] : plan === "full" ? [["When you approve", t]] : ms.map((m, i) => [`Milestone ${i + 1} approved`, Number(m) || 0]);

  if (missing) return <main className="mx-auto flex min-h-dvh max-w-[560px] flex-col items-center justify-center px-6 text-center"><h1 className="text-[22px] font-semibold">We couldn&apos;t find that person</h1><Link href="/search" className="btn btn-ghost mt-6">Search people</Link></main>;
  if (!p) return <main className="mx-auto min-h-dvh max-w-[560px] px-5 pt-24"><div className="skeleton h-16 rounded-[20px]" /><div className="skeleton mt-4 h-40 rounded-[20px]" /></main>;

  async function send() {
    if (!p) return;
    setErr(null); setSending(true);
    try {
      const units = (n: number) => Math.round(n * 1e6);
      const body: Record<string, unknown> = {
        counterparty: p.wallet, iAm: "client", title: title.trim(), deliverables: deliv.map((d) => d.trim()).filter(Boolean),
        doneMeans: done.trim(), revisions: rev, deadline: Math.floor((now + days * 864e5) / 1000), deadlockRule: rule,
      };
      if (plan === "milestones") { body.upfront = 0; body.milestones = ms.map((m) => units(Number(m) || 0)); }
      else if (plan === "upfront") { body.total = units(t); body.upfrontBps = level.upfrontPct * 100; }
      else body.total = units(t);
      const res = await fetch("/api/jobs", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await res.json();
      if (res.status === 401) { r.push("/signup"); return; }
      if (!res.ok) throw new Error(j.error ?? "Could not create the agreement");
      setJobId(j.id);
      if (circleReady()) await sendCalls(j.calls as Call[]); // propose onchain (gasless), user approves in Circle's window
      setStep(2);
    } catch (e) { setErr((e as Error).message); } finally { setSending(false); }
  }

  if (step === 2) return (
    <main className="mx-auto flex min-h-dvh max-w-[560px] flex-col items-center justify-center px-6 text-center">
      <div className="rise grid h-16 w-16 place-items-center rounded-full bg-fg text-[var(--bg)]"><Check size={28} /></div>
      <h1 className="rise mt-6 text-[26px] font-semibold tracking-[-0.035em]" style={{ animationDelay: "80ms" }}>Agreement sent</h1>
      <p className="rise mt-2 max-w-[300px] text-[14px] leading-relaxed text-muted" style={{ animationDelay: "140ms" }}>When {p.name.split(" ")[0]} accepts, you&apos;ll fund ${t.toFixed(2)} into escrow. Nothing leaves your wallet until then.</p>
      <Link href={jobId ? `/jobs/${jobId}` : "/jobs"} className="btn btn-solid rise mt-8 w-full" style={{ animationDelay: "200ms" }}>View invoice</Link>
      <Link href="/social" className="mt-3 text-[13px] text-muted">Back to feed</Link>
    </main>
  );

  return (
    <main className="mx-auto min-h-dvh max-w-[560px] pb-32">
      <TopBar back={step ? undefined : `/u/${handle}`} title={step ? "Review agreement" : "New agreement"} />
      {step === 1 && <button onClick={() => setStep(0)} className="absolute left-5 top-[max(16px,env(safe-area-inset-top))] z-40 h-10 w-10" aria-label="Back" />}

      <div className="px-5">
        <div className="flex items-center gap-3 rounded-[20px] hairline p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.avatar} alt="" className="h-11 w-11 rounded-[14px] object-cover" />
          <div className="min-w-0 flex-1 leading-tight"><div className="text-[14px] font-medium">{p.name}</div><div className="text-[12px] text-muted">{p.title} · {p.jobs} paid jobs · {p.rating}★</div></div>
        </div>

        {step === 0 ? (
          <div className="rise mt-7 flex flex-col gap-7">
            <label className="flex flex-col gap-2"><span className="label">What&apos;s the job</span><input className="field" value={title} onChange={(e) => setTitle(e.target.value)} /></label>

            <div className="flex flex-col gap-2"><span className="label">Deliverables</span>
              {deliv.map((d, i) => <input key={i} className="field" value={d} onChange={(e) => { const n = [...deliv]; n[i] = e.target.value; setDeliv(n); }} />)}
              {deliv.length < 10 && <button onClick={() => setDeliv([...deliv, ""])} className="flex items-center gap-2 self-start py-1 text-[13px] text-muted"><Plus size={16} /> Add deliverable</button>}
            </div>

            <label className="flex flex-col gap-2"><span className="label">Done means</span><textarea rows={2} className="field" value={done} onChange={(e) => setDone(e.target.value)} />
              <span className="text-[12px] text-faint">If there&apos;s ever a disagreement, this sentence is what counts.</span></label>

            <div className="flex flex-col gap-2"><span className="label">Total</span>
              <div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-[22px] text-faint">$</span>
                <input inputMode="decimal" value={total} onChange={(e) => setTotal(e.target.value.replace(/[^\d.]/g, ""))} className="field num h-[64px] pl-9 text-[26px] font-medium" />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[13px] text-faint">USDC</span></div>
              <span className={`text-[12px] ${over || under ? "text-fg" : "text-faint"}`}>{over ? "The limit is $100 per job for now." : under ? "Minimum is $1." : "No platform fee. Gas is sponsored, so it's free to send."}</span>
            </div>

            <div className="flex flex-col gap-2"><span className="label">How money is released</span>
              <div className="grid grid-cols-3 gap-1 rounded-full hairline p-1">
                {([["full", "On approval"], ["milestones", "Milestones"], ["upfront", canUpfront ? `${level.upfrontPct}% upfront` : "Upfront"]] as const).map(([k, l]) => (
                  <button key={k} disabled={k === "upfront" && !canUpfront} onClick={() => setPlan(k)} className={`h-9 rounded-full text-[13px] transition-colors disabled:text-faint ${plan === k ? "bg-pill font-medium text-pill-fg" : "text-muted"}`}><span className="inline-flex items-center gap-1">{k === "upfront" && !canUpfront && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden><rect x="5.5" y="10.5" width="13" height="9.5" rx="2.5" /><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" /></svg>}{l}</span></button>
                ))}
              </div>
              <span className="text-[12px] leading-relaxed text-faint">{canUpfront
                ? `${p.name.split(" ")[0]} is ${level.name}: verified with a clean record, so up to ${level.upfrontPct}% can be paid when work starts.`
                : `Upfront payment unlocks when an artisan is verified and has a proven record (Trusted level). Until then, money is released on approval.`}</span>
              {plan === "milestones" && (
                <div className="mt-2 flex flex-col gap-2">
                  {ms.map((m, i) => (
                    <div key={i} className="flex items-center gap-3"><span className="w-24 text-[13px] text-muted">Milestone {i + 1}</span>
                      <div className="relative flex-1"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-faint">$</span><input inputMode="decimal" value={m} onChange={(e) => { const n = [...ms]; n[i] = e.target.value.replace(/[^\d.]/g, ""); setMs(n); }} className="field num pl-8" /></div></div>
                  ))}
                  <div className="flex justify-between text-[12px]"><button onClick={() => ms.length < 10 && setMs([...ms, "0"])} className="text-muted">+ Add milestone</button><span className={msOk ? "text-faint" : "text-fg"}>{msOk ? "Adds up" : `Adds up to $${msSum}, total is $${t}`}</span></div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2"><span className="label">Revisions</span>
                <div className="flex h-[52px] items-center justify-between rounded-[16px] hairline px-2">
                  <button onClick={() => setRev(Math.max(0, rev - 1))} className="press h-9 w-9 rounded-full text-[18px] text-muted">−</button><span className="num text-[17px]">{rev}</span><button onClick={() => setRev(Math.min(5, rev + 1))} className="press h-9 w-9 rounded-full text-[18px] text-muted">+</button></div></div>
              <div className="flex flex-col gap-2"><span className="label">Deadline</span>
                <div className="flex h-[52px] items-center justify-between rounded-[16px] hairline px-2">
                  <button onClick={() => setDays(Math.max(1, days - 1))} className="press h-9 w-9 rounded-full text-[18px] text-muted">−</button><span className="num text-[15px]">{days}d · {deadline}</span><button onClick={() => setDays(Math.min(60, days + 1))} className="press h-9 w-9 rounded-full text-[18px] text-muted">+</button></div></div>
            </div>

            <div className="flex flex-col gap-2"><span className="label">If you can&apos;t agree</span>
              <div className="overflow-hidden rounded-[20px] hairline">
                {RULES.map((r, i) => (
                  <button key={r.id} onClick={() => setRule(r.id)} className={`flex w-full items-center gap-3 px-4 py-3.5 text-left ${i ? "border-t border-line" : ""}`}>
                    <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border ${rule === r.id ? "border-fg bg-fg text-[var(--bg)]" : "border-line-strong"}`}>{rule === r.id && <Check size={12} />}</span>
                    <span className="flex-1"><span className="block text-[14px]">{r.t}</span><span className="block text-[12px] text-muted">{r.d}</span></span>
                  </button>
                ))}
              </div>
              <span className="text-[12px] leading-relaxed text-faint">Either of you can offer a split at any time. If nobody accepts within 48 hours, this rule applies. No one judges, not even us.</span>
            </div>
          </div>
        ) : (
          <div className="rise mt-6">
            {/* invoice-style summary */}
            <div className="card overflow-hidden">
              <div className="p-5">
                <div className="eyebrow">Agreement</div>
                <div className="mt-1 text-[19px] font-medium tracking-[-0.02em]">{title}</div>
                <div className="num mt-4 text-[40px] font-semibold leading-none">${t.toFixed(2)}<span className="ml-1.5 text-[14px] font-normal text-faint">USDC</span></div>
              </div>
              <div className="rule" />
              <dl className="flex flex-col p-5 text-[14px]">
                {[["Deliverables", deliv.filter(Boolean).join(" · ")], ["Done means", done], ["Revisions", `${rev} included`], ["Deadline", deadline], ["If you can't agree", RULES.find((r) => r.id === rule)!.t]].map(([k, v], i) => (
                  <div key={k} className={`flex gap-4 py-3 ${i ? "border-t border-line" : ""}`}><dt className="w-28 shrink-0 text-muted">{k}</dt><dd className="flex-1">{v}</dd></div>
                ))}
              </dl>
              <div className="rule" />
              <div className="p-5">
                <div className="label mb-3">Release schedule</div>
                {schedule.map(([k, v], i) => (
                  <div key={i} className="flex items-center gap-3 py-1.5 text-[14px]"><span className="num grid h-6 w-6 place-items-center rounded-full hairline text-[11px] text-muted">{i + 1}</span><span className="flex-1">{k}</span><span className="num">${Number(v).toFixed(2)}</span></div>
                ))}
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-2.5 text-[12.5px] leading-relaxed text-muted">
              <p>· You fund 100% into escrow after {p.name.split(" ")[0]} accepts. Arctisans never holds your money; the contract does.</p>
              <p>· If {p.name.split(" ")[0]} goes 3 days without an update, unreleased money comes back to you.</p>
              <p>· If you don&apos;t respond to a delivery for 3 days, it moves to settlement.</p>
            </div>
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-[var(--rail)] right-[var(--aside)] z-40 flex justify-center bg-gradient-to-t from-[var(--bg)] via-[var(--bg)] to-transparent px-5 pb-[max(18px,env(safe-area-inset-bottom))] pt-8">
        <div className="w-full max-w-[440px]">
          {step === 0
            ? <button disabled={over || under || !msOk || !title.trim()} onClick={() => setStep(1)} className="btn btn-solid w-full">Review · ${t.toFixed(2)}</button>
            : <div className="flex flex-col gap-2">{err && <p className="rounded-[14px] hairline px-4 py-2.5 text-[13px] text-fg">{err}</p>}<div className="flex gap-2"><button disabled={sending} onClick={() => setStep(0)} className="btn btn-ghost">Edit</button><button disabled={sending} onClick={send} className="btn btn-solid flex-1">{sending ? "Waiting for approval…" : "Send agreement"}</button></div></div>}
        </div>
      </div>
    </main>
  );
}
