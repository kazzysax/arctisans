"use client";
import { useEffect, useState } from "react";
import { Bot, BotStyles, BOT_LOOK } from "@/components/DreamBots";
import { TopBar } from "@/components/ui";
import { sendCalls, circleReady, type Call } from "@/lib/walletClient";

type Opt = { id: string; label: string };
type Q = { id: string; section: string; text: string; multi: boolean; options: Opt[] };
type Pay = { id: string; from: string; to: string; micro: number; status: "paid" | "failed"; tx: string | null; why: string };
type TabV = { deposited: number; spent: number; withdrawn: number; left: number };
type V = {
  payments: Pay[];
  tab: TabV | null;
  usesTab: boolean;
  withdraw: Call | null;
  id: string; idea: string; status: string; questions: Q[]; followups: Q[]; ready: boolean; skills: string[]; callsLeft: number;
  plan: null | { name: string; oneLiner: string; audience: string; roles: string[]; mustHave: string[]; later: string[]; acceptance: string[]; vibe: string; screens: string[]; rules: string[]; mustNot: string[] };
  research: null | { stack: { layer: string; choice: string; why: string }[]; architecture: string; dataModel: string[]; integrations: { name: string; why: string }[]; arcPieces: { piece: string; why: string }[]; studioCovers: string[]; outsideStudio: string[]; milestones: string[]; risks: string[]; similar: { name: string; lesson: string }[]; skills: string[]; sources: string[] };
};
type Stage = "idea" | "paying" | "asking" | "research" | "follow" | "done";

const DOGS = [
  { k: "mochi", name: "Mochi", role: "Planner", tint: "#ffd9a8", ear: "#c98b4a", say: "Pick the look, the people and the money rules." },
  { k: "scout", name: "Scout", role: "Researcher", tint: "#cfe3ff", ear: "#6a8fc4", say: "I dig through what already exists on Arc." },
  { k: "bolt", name: "Bolt", role: "Builder", tint: "#d9f2cf", ear: "#6fa35c", say: "I pack it up and send it to your Studio." },
] as const;



type Dk = (typeof DOGS)[number]["k"];
const STEPS = ["Plan", "Research", "Build"];
const stepOf = (s: Stage) => (s === "asking" ? 0 : s === "research" ? (1) : s === "follow" ? 1 : s === "done" ? 2 : -1);
const SECTIONS = [["specs", "Specs"], ["features", "Features"], ["design", "Design"]] as const;
const usd = (n: number) => `$${n.toFixed(2)}`;

/** The dogs' running budget. A ledger inside the room: it shows how the $1 is shared out as work moves along. Not an onchain transfer yet. */
const START = { mochi: 0.40, scout: 0.40, bolt: 0.20 } as Record<Dk, number>;
const PAYS: { from: Dk; to: Dk; amt: number; why: string; at: Stage[] }[] = [
  { from: "mochi", to: "scout", amt: 0.08, why: "for the finished plan", at: ["follow", "done"] },
  { from: "scout", to: "bolt", amt: 0.08, why: "for the research", at: ["done"] },
];
/** Real settled payments move the balances. With none (Nanopayments off, or a payment failed) the room shows the practice split, labelled as such. */
const balances = (stage: Stage, real: Pay[]) => {
  const b = { ...START };
  const paid = real.filter((p) => p.status === "paid");
  if (paid.length) { for (const p of paid) { b[p.from as Dk] -= p.micro / 1e6; b[p.to as Dk] += p.micro / 1e6; } return b; }
  for (const p of PAYS) if (p.at.includes(stage)) { b[p.from] -= p.amt; b[p.to] += p.amt; }
  return b;
};

type Line = { dog: Dk; text: string; pay?: (typeof PAYS)[number] };
/** What the dogs say, built from the real work so far. Nothing here calls a model. */
function script(stage: Stage, v: V | null, busy: boolean): Line[] {
  const L: Line[] = [{ dog: "mochi", text: "Hi, I'm Mochi. Give me one line and we'll run a proper kickoff: specs, features and design." }];
  if (stage === "idea") return L;
  L.push({ dog: "bolt", text: "Entry is in. Budget is split between us, and I'll keep the ledger." });
  if (stage === "paying") return L;
  L.push({ dog: "mochi", text: busy && stage === "asking" ? "Writing your questions now…" : "Nine questions, three sections. Answer like it is a real project, because it is." });
  if (stage === "asking") return L;
  if (v?.plan) L.push({ dog: "mochi", text: `Plan Card done: ${v.plan.name}, with ${v.plan.mustHave.length} must-haves and ${v.plan.acceptance.length} checks.` });
  if (stage === "research") { L.push({ dog: "scout", text: "My turn. Searching the web for how this kind of product gets built…" }); return L; }
  L.push({ dog: "scout", text: `Done digging${v?.research?.sources.length ? `, ${v.research.sources.length} sources read` : ""}. I found ${v?.followups.length ?? 0} gap${(v?.followups.length ?? 0) === 1 ? "" : "s"} only you can settle.` });
  L.push({ dog: "mochi", text: "Thanks Scout, here is your cut.", pay: PAYS[0] });
  if (stage === "follow") return L;
  L.push({ dog: "bolt", text: "Got it all. Packing the Dream Sheet for your Studio." });
  L.push({ dog: "scout", text: "Sending Bolt his share.", pay: PAYS[1] });
  L.push({ dog: "bolt", text: "Dream Sheet is ready. Time to hand it to Studio." });
  return L;
}

async function api(path: string, body?: unknown) {
  const r = await fetch(path, { method: body ? "POST" : "GET", credentials: "include", headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.error ?? "Something went wrong"), { status: r.status });
  return j;
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="mt-3 rounded-[24px] hairline p-5"><div className="text-[12px] uppercase tracking-[0.14em] text-faint">{title}</div>{children}</div>;
}
const Bullets = ({ items }: { items: string[] }) => <ul className="mt-1.5 text-[14px] leading-relaxed">{items.map((x) => <li key={x} className="mb-0.5">· {x}</li>)}</ul>;

export default function Dreams() {
  const [stage, setStage] = useState<Stage>("idea");
  const [idea, setIdea] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [v, setV] = useState<V | null>(null);
  const [pick, setPick] = useState<Record<string, string[]>>({});
  const [sheet, setSheet] = useState<{ sheet: string; command: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [hash, setHash] = useState<string | null>(null);
  const [tab, setTab] = useState(0);
  const [report, setReport] = useState(false);

  useEffect(() => { // resume an unfinished dream after a reload
    const id = localStorage.getItem("dream:id"); if (!id) return;
    api(`/api/dreams/${id}`).then((x: V) => enter(x)).catch(() => localStorage.removeItem("dream:id"));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function enter(x: V) {
    setV(x); setPick({}); setTab(0);
    if (x.status === "asking") setStage("asking");
    else if (x.status === "researched") setStage("follow");
    else if (x.status === "ready") { setStage("done"); api(`/api/dreams/${x.id}/sheet`).then(setSheet).catch(() => {}); }
    else if (x.status === "paid" || x.status === "planned") { setStage(x.status === "paid" ? "asking" : "research"); void step(x.id, {}); }
    else if (x.status === "new") setStage("paying");
  }
  async function step(id: string, body: unknown) {
    setBusy(true); setErr(null);
    const was = stage;
    try {
      if ((body as { answers?: unknown }).answers) setStage("research");
      const x = await api(`/api/dreams/${id}`, body); enter(x);
    } catch (e) { setErr((e as Error).message); if (was === "asking" || was === "follow") setStage(was); } finally { setBusy(false); }
  }
  async function begin() {
    setErr(null); setBusy(true);
    try {
      if (!circleReady()) throw new Error("Sign in first, then come back to the arena.");
      const made = await api("/api/dreams", { idea });
      localStorage.setItem("dream:id", made.id);
      setStage("paying");
      const h = await sendCalls(made.calls as Call[]);
      if (!h) throw new Error("The payment did not go through.");
      setHash(h);
      const x = await retryPay(made.id, h);
      enter(x);
    } catch (e) { setErr((e as Error).message); setStage("idea"); } finally { setBusy(false); }
  }
  async function retryPay(id: string, h: string): Promise<V> {
    for (let i = 0; i < 6; i++) {
      try { return await api(`/api/dreams/${id}`, { hash: h }); }
      catch (e) { if ((e as { status?: number }).status !== 409 || i === 5) throw e; await new Promise((r) => setTimeout(r, 2500)); }
    }
    throw new Error("The payment is still settling. Open the arena again in a minute.");
  }
  async function withdraw() {
    if (!v?.withdraw) return;
    setErr(null); setBusy(true);
    try {
      const h = await sendCalls([v.withdraw]);
      if (!h) throw new Error("The withdrawal did not go through.");
      for (let i = 0; i < 6; i++) { const x = await api(`/api/dreams/${v.id}`); setV(x); if (x.tab && x.tab.left === 0) break; await new Promise((r) => setTimeout(r, 2000)); }
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  const copy = (k: string, t: string) => { void navigator.clipboard.writeText(t); setCopied(k); setTimeout(() => setCopied(null), 1600); };
  const reset = () => { localStorage.removeItem("dream:id"); setV(null); setSheet(null); setIdea(""); setStage("idea"); setErr(null); setReport(false); };
  const toggle = (q: Q, id: string) => setPick((p) => {
    const cur = p[q.id] ?? [];
    return { ...p, [q.id]: q.multi ? (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]) : [id] };
  });

  const qs = stage === "asking" ? v?.questions ?? [] : stage === "follow" ? v?.followups ?? [] : [];
  const all = qs.length > 0 && qs.every((q) => (pick[q.id] ?? []).length > 0);
  const lines = script(stage, v, busy);
  const last = lines[lines.length - 1];
  const speaker: Dk = stage === "asking" ? "mochi" : stage === "research" ? "scout" : stage === "follow" ? "scout" : stage === "done" ? "bolt" : "mochi";
  const real = v?.payments ?? [];
  const settled = real.filter((p) => p.status === "paid");
  const bal = balances(stage, real);
  const net = (k: Dk) => settled.reduce((n, p) => n + (p.to === k ? p.micro : 0) - (p.from === k ? p.micro : 0), 0) / 1e6;
  const lastPay = [...lines].reverse().find((l) => l.pay)?.pay;
  const s = stepOf(stage);
  const sections = stage === "asking" ? SECTIONS.filter(([k]) => qs.some((q) => q.section === k)) : [];
  const shown = stage === "asking" && sections.length ? qs.filter((q) => q.section === sections[Math.min(tab, sections.length - 1)][0]) : qs;
  const answered = (k: string) => qs.filter((q) => q.section === k).every((q) => (pick[q.id] ?? []).length > 0);

  return (
    <main className="mx-auto min-h-dvh max-w-[560px] pb-24">
      <TopBar back="/create" title="Arcdreams" right={stage !== "idea" ? <button onClick={reset} className="text-[13px] text-muted">Start over</button> : undefined} />
      <style>{`@keyframes dogwag{0%,100%{transform:rotate(-4deg)}50%{transform:rotate(5deg)}}@keyframes pop{0%{transform:scale(.92);opacity:0}100%{transform:scale(1);opacity:1}}@keyframes sniff{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}@keyframes coin{0%{transform:translate(0,0) scale(.6);opacity:0}15%{opacity:1;transform:translate(0,-14px) scale(1)}85%{opacity:1}100%{transform:translate(var(--dx),-2px) scale(.9);opacity:0}}@keyframes say{0%{transform:translateY(6px);opacity:0}100%{transform:translateY(0);opacity:1}}`}</style>

      {s >= 0 && (
        <div className="px-5 pt-1">
          <div className="flex items-center gap-2">{STEPS.map((n, i) => (
            <div key={n} className="flex-1">
              <div className="h-[5px] overflow-hidden rounded-full bg-[var(--line-strong)]"><div className="h-full rounded-full bg-[var(--fg)] transition-all duration-700" style={{ width: i < s || stage === "done" ? "100%" : i === s ? "55%" : "0%" }} /></div>
              <div className={`mt-1.5 text-[11px] uppercase tracking-[0.14em] ${i <= s ? "text-fg" : "text-faint"}`}>{n}</div>
            </div>))}</div>
        </div>
      )}

      {/* The fun house: a lit room with the crew on cushions, the speaker in front, coins hopping between them. */}
      <BotStyles />
      <div className="px-5 pt-4">
        <div className="relative overflow-hidden rounded-[28px] px-3 pb-3 pt-4 text-white" style={{ background: "radial-gradient(110% 80% at 50% 0%, #2c2f5e 0%, #17182e 50%, #0c0c16 100%)" }}>
          <div aria-hidden className="pointer-events-none absolute inset-0" style={{ backgroundImage: "radial-gradient(rgba(255,255,255,.5) 1px, transparent 1.4px)", backgroundSize: "24px 24px", maskImage: "linear-gradient(180deg, rgba(0,0,0,.3), transparent 55%)", WebkitMaskImage: "linear-gradient(180deg, rgba(0,0,0,.3), transparent 55%)" }} />
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-[96px] bottom-0" style={{ background: "linear-gradient(180deg, rgba(255,255,255,0), rgba(255,255,255,.05))", borderTop: "1px solid rgba(255,255,255,.07)" }} />
          <div className="relative grid grid-cols-3 gap-1">
            {DOGS.map((d, di) => {
              const on = d.k === speaker;
              return (
                <div key={d.k} className="relative flex flex-col items-center">
                  <div aria-hidden className="absolute top-[8px] h-[86px] w-[86px] rounded-full transition-opacity duration-500" style={{ opacity: on ? 1 : 0, background: `radial-gradient(circle, ${BOT_LOOK[d.k].body}55, transparent 68%)` }} />
                  <div className={`relative transition-all duration-500 ${on ? "scale-110" : "scale-95 opacity-70"}`}><Bot k={d.k} size={78} talking={on && busy} delay={di * 400} /></div>
                  <div aria-hidden className="-mt-2 h-[8px] w-[56px] rounded-[50%]" style={{ background: on ? BOT_LOOK[d.k].shade : "rgba(255,255,255,.14)", opacity: on ? 0.55 : 1, filter: "blur(1px)" }} />
                  <div className="mt-2 text-[13px] font-semibold">{d.name}</div>
                  <div className="text-[10px] uppercase tracking-[0.14em] text-white/45">{d.role}</div>
                  <div className="num mt-1.5 rounded-full bg-white/10 px-2 py-0.5 text-[11px]">{settled.length ? `${net(d.k) >= 0 ? "+" : "-"}${usd(Math.abs(net(d.k)))}` : usd(stage === "idea" ? 0 : bal[d.k])}</div>
                </div>
              );
            })}
          </div>
          {lastPay && (() => {
            const i = DOGS.findIndex((d) => d.k === lastPay.from), j = DOGS.findIndex((d) => d.k === lastPay.to);
            return <span key={lastPay.from + stage} aria-hidden className="num pointer-events-none absolute top-[70px] z-10 rounded-full bg-[#ffd84d] px-2 py-0.5 text-[11px] font-semibold text-black shadow-[0_6px_16px_rgba(255,216,77,.35)]" style={{ left: `calc(${(i + 0.5) * 33.33}% - 22px)`, ["--dx" as string]: `${(j - i) * 33.33 * 4.6}px`, animation: "coin 1.6s ease-in-out both" }}>{usd(lastPay.amt)}</span>;
          })()}
          <div key={stage + last.text} className="relative mt-4 rounded-[18px] bg-white p-3.5 text-black" style={{ animation: "say 380ms var(--ease-out) both" }}>
            <span aria-hidden className="absolute -top-[7px] h-[14px] w-[14px] rotate-45 bg-white" style={{ left: `calc(${(DOGS.findIndex((x) => x.k === last.dog) + 0.5) * 33.33}% - 7px)` }} />
            <div className="text-[11px] uppercase tracking-[0.14em] text-black/45">{DOGS.find((d) => d.k === last.dog)!.name}{last.pay ? ` · paid ${usd(last.pay.amt)} ${last.pay.why}` : ""}</div>
            <div className="mt-1 text-[15px] leading-snug">{stage === "idea" ? "Hi, I'm Mochi. Give me one line and we'll run a proper kickoff: specs, features and design." : last.text}</div>
          </div>
        </div>
        {v?.tab && stage !== "idea" && (
          <div className="mt-3 flex items-center justify-between rounded-[18px] hairline px-4 py-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.14em] text-faint">Your tab</div>
              <div className="num mt-0.5 text-[15px]">Spent {usd(v.tab.spent / 1e6)} · {v.tab.left > 0 ? `${usd(v.tab.left / 1e6)} left` : v.tab.withdrawn > 0 ? `${usd(v.tab.withdrawn / 1e6)} returned to you` : "used up"}</div>
            </div>
            {v.tab.left > 0 && <button disabled={busy} onClick={withdraw} className="btn btn-ghost !px-4 !py-2 text-[13px]">{stage === "done" ? "Get my refund" : "Withdraw"}</button>}
          </div>
        )}
        {stage !== "idea" && (
          <p className="mt-2 text-[12px] text-faint">
            {settled.length ? `${settled.length} payment${settled.length === 1 ? "" : "s"} settled on Arc through Circle Nanopayments` : real.length ? "A payment did not settle, so the dogs worked on the house." : "Practice ledger: shows how the budget is shared."}
          </p>
        )}
        {settled.length > 0 && (
          <ul className="mt-1 space-y-1 text-[12px] text-muted">{settled.map((p) => <li key={p.id}>{DOGS.find((d) => d.k === p.from)!.name} paid {DOGS.find((d) => d.k === p.to)!.name} {usd(p.micro / 1e6)} {p.why}{p.tx ? ` · ${p.tx.slice(0, 10)}…` : ""}</li>)}</ul>
        )}
        {stage !== "idea" && lines.length > 1 && (
          <details className="mt-2 text-[12px] text-muted"><summary className="cursor-pointer select-none">Room chat ({lines.length})</summary>
            <ul className="mt-2 space-y-1.5">{lines.map((l, i) => <li key={i}><span className="font-medium text-fg">{DOGS.find((d) => d.k === l.dog)!.name}:</span> {l.text}{l.pay ? ` (${usd(l.pay.amt)} sent)` : ""}</li>)}</ul>
          </details>
        )}
      </div>

      {err && <p className="mx-5 mt-4 rounded-[16px] hairline p-3 text-[13px]">{err}</p>}

      {stage === "idea" && (
        <div className="rise px-5 pt-5">
          <textarea value={idea} onChange={(e) => setIdea(e.target.value.slice(0, 280))} rows={3} placeholder="e.g. A tip jar where fans tip a creator in USDC and see a leaderboard" className="field w-full resize-none" />
          <div className="mt-1 flex justify-between text-[12px] text-faint"><span>{idea.trim().length < 12 ? "A few more words" : "Good"}</span><span>{idea.length}/280</span></div>
          <button disabled={idea.trim().length < 12 || busy} onClick={begin} className="btn btn-solid mt-6 w-full">{busy ? "Opening the gate…" : "Open a $1 tab"}</button>
          <p className="mt-3 text-center text-[12px] leading-relaxed text-faint">You put $1 on a tab. Each step takes only what it costs, and you can withdraw the rest at any time. Your build then runs in your own Arc Studio, on testnet.</p>
        </div>
      )}

      {stage === "paying" && !hash && !busy && v?.status === "new" && <p className="px-5 pt-5 text-center text-[13px] text-muted">Approve the $1 deposit in your wallet window.</p>}

      {(stage === "asking" || stage === "follow") && qs.length > 0 && (
        <div className="px-5 pt-4">
          {sections.length > 1 && (
            <div className="mb-4 grid grid-cols-3 gap-2">{sections.map(([k, n], i) => (
              <button key={k} onClick={() => setTab(i)} className={`press rounded-full border px-3 py-2 text-[13px] ${i === Math.min(tab, sections.length - 1) ? "border-fg bg-[var(--fg)] text-[var(--bg)]" : "border-[var(--line-strong)]"}`}>{n}{answered(k) ? " ✓" : ""}</button>
            ))}</div>
          )}
          {shown.map((q, qi) => (
            <div key={q.id} className="rise mb-6" style={{ animationDelay: `${qi * 70}ms` }}>
              <div className="text-[17px] font-medium leading-snug tracking-[-0.02em]">{q.text}</div>
              {q.multi && <div className="mt-1 text-[12px] text-faint">Pick all that apply</div>}
              <div className="mt-3 grid gap-2">{q.options.map((o) => {
                const on = (pick[q.id] ?? []).includes(o.id);
                return <button key={o.id} onClick={() => toggle(q, o.id)} className={`press rounded-[18px] border px-4 py-3.5 text-left text-[15px] transition-colors ${on ? "border-fg bg-[var(--fg)] text-[var(--bg)]" : "border-[var(--line-strong)]"}`}>{o.label}</button>;
              })}</div>
            </div>))}
          {stage === "asking" && sections.length > 1 && Math.min(tab, sections.length - 1) < sections.length - 1 && (
            <button onClick={() => { setTab((t) => t + 1); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="btn btn-ghost mb-3 w-full">Next: {sections[Math.min(tab, sections.length - 1) + 1][1]}</button>
          )}
          <button disabled={!all || busy} onClick={() => step(v!.id, { answers: Object.fromEntries(Object.entries(pick).map(([k, x]) => [k, { optionIds: x }])) })} className="btn btn-solid w-full">{busy ? "The dogs are working…" : stage === "asking" ? (all ? "Send to the dogs" : `Answer all ${qs.length} to continue`) : "Finish the Dream Sheet"}</button>
        </div>
      )}

      {stage === "research" && <p className="px-5 pt-6 text-center text-[13px] text-muted">{busy ? "This takes about half a minute. The dogs are reading real sources." : "Starting…"}</p>}

      {stage === "done" && v && (
        <div className="rise px-5 pt-4">
          {sheet && (
            <div className="rounded-[24px] hairline p-5">
              <div className="flex items-center gap-3"><Bot k="bolt" size={40} /><div><div className="text-[15px] font-medium">Bolt&apos;s hand-off</div><div className="text-[12px] text-muted">Runs in your own Arc Studio, on your account</div></div></div>
              <ol className="mt-4 space-y-2 text-[14px] leading-relaxed text-muted">
                <li><span className="num text-fg">1.</span> Install Studio once: <code className="text-fg">npm i -g @circle-fin/arc-studio-cli</code> and run <code className="text-fg">arc-studio login</code>.</li>
                <li><span className="num text-fg">2.</span> Save the sheet as <code className="text-fg">dream.md</code> in a folder.</li>
                <li><span className="num text-fg">3.</span> Run the command below. Studio plans, audits, deploys, and builds the app.</li>
              </ol>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button onClick={() => copy("sheet", sheet.sheet)} className="btn btn-solid">{copied === "sheet" ? "Copied" : "Copy sheet"}</button>
                <button onClick={() => copy("cmd", sheet.command)} className="btn btn-ghost">{copied === "cmd" ? "Copied" : "Copy run line"}</button>
              </div>
              <a className="mt-3 block text-center text-[13px] text-muted underline underline-offset-4" href={`data:text/markdown;charset=utf-8,${encodeURIComponent(sheet.sheet)}`} download="dream.md">Download dream.md</a>
              <p className="mt-3 text-[12px] leading-relaxed text-faint">Studio deploys to Arc testnet only. Review everything before using real money.</p>
            </div>)}

          <button onClick={() => setReport((r) => !r)} className="btn btn-ghost mt-3 w-full">{report ? "Hide the full project report" : "Read the full project report"}</button>
          {report && v.plan && (<>
            <Card title={`Plan · ${v.plan.name}`}>
              <p className="mt-1 text-[14px] text-muted">{v.plan.oneLiner}</p>
              <div className="mt-3 text-[12px] uppercase tracking-[0.14em] text-faint">Users and roles</div><Bullets items={v.plan.roles} />
              <div className="mt-3 text-[12px] uppercase tracking-[0.14em] text-faint">Must-have features</div><Bullets items={v.plan.mustHave} />
              {v.plan.later.length > 0 && <><div className="mt-3 text-[12px] uppercase tracking-[0.14em] text-faint">Later</div><Bullets items={v.plan.later} /></>}
              <div className="mt-3 text-[12px] uppercase tracking-[0.14em] text-faint">Acceptance criteria</div><Bullets items={v.plan.acceptance} />
              <div className="mt-3 text-[12px] uppercase tracking-[0.14em] text-faint">Design</div><p className="mt-1.5 text-[14px]">{v.plan.vibe}</p><Bullets items={v.plan.screens} />
              <div className="mt-3 text-[12px] uppercase tracking-[0.14em] text-faint">Contract rules</div><Bullets items={v.plan.rules} />
            </Card>
            {v.research && (<>
              <Card title="Research · stack and architecture">
                <ul className="mt-2 text-[14px] leading-relaxed">{v.research.stack.map((x) => <li key={x.layer} className="mb-1.5"><span className="font-medium capitalize">{x.layer}</span>: {x.choice} <span className="text-muted">· {x.why}</span></li>)}</ul>
                <p className="mt-3 text-[14px] leading-relaxed">{v.research.architecture}</p>
                <div className="mt-3 text-[12px] uppercase tracking-[0.14em] text-faint">Data</div><Bullets items={v.research.dataModel} />
              </Card>
              <Card title="Where Studio fits">
                <div className="mt-1 text-[13px] font-medium">Studio builds</div><Bullets items={v.research.studioCovers} />
                {v.research.outsideStudio.length > 0 && <><div className="mt-3 text-[13px] font-medium">You handle outside Studio</div><Bullets items={v.research.outsideStudio} /></>}
              </Card>
              <Card title="Milestones, risks and similar products">
                <ol className="mt-2 text-[14px] leading-relaxed">{v.research.milestones.map((x, i) => <li key={x} className="mb-1"><span className="num text-faint">{i + 1}.</span> {x}</li>)}</ol>
                <div className="mt-3 text-[12px] uppercase tracking-[0.14em] text-faint">Watch out for</div><Bullets items={v.research.risks} />
                {v.research.similar.length > 0 && <><div className="mt-3 text-[12px] uppercase tracking-[0.14em] text-faint">Similar products</div><ul className="mt-1.5 text-[14px] leading-relaxed">{v.research.similar.map((x) => <li key={x.name} className="mb-1"><span className="font-medium">{x.name}</span> <span className="text-muted">· {x.lesson}</span></li>)}</ul></>}
                {v.research.sources.length > 0 && <><div className="mt-3 text-[12px] uppercase tracking-[0.14em] text-faint">Sources Scout read</div><ul className="mt-1.5 break-all text-[12px] leading-relaxed text-muted">{v.research.sources.map((u) => <li key={u}><a href={u} target="_blank" rel="noreferrer noopener" className="underline underline-offset-4">{u.replace(/^https?:\/\/(www\.)?/, "").slice(0, 60)}</a></li>)}</ul></>}
              </Card>
            </>)}
          </>)}
          <button onClick={reset} className="btn btn-ghost mt-4 w-full">Dream something else</button>
        </div>
      )}
    </main>
  );
}
