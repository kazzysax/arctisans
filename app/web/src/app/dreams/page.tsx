"use client";
import { useEffect, useState } from "react";
import { TopBar } from "@/components/ui";
import { sendCalls, circleReady, type Call } from "@/lib/walletClient";

type Opt = { id: string; label: string };
type Q = { id: string; text: string; options: Opt[] };
type V = {
  id: string; idea: string; status: string; questions: Q[]; followups: Q[]; ready: boolean; skills: string[]; callsLeft: number;
  plan: null | { name: string; oneLiner: string; vibe: string; audience: string; screens: string[]; rules: string[]; mustNot: string[] };
  research: null | { use: { piece: string; why: string }[]; risks: string[]; similar: string[]; skills: string[] };
};
type Stage = "idea" | "paying" | "asking" | "research" | "follow" | "done";

const DOGS = [
  { k: "mochi", name: "Mochi", role: "Planner", tint: "#ffd9a8", ear: "#c98b4a", say: "Pick the look, the people and the money rules." },
  { k: "scout", name: "Scout", role: "Researcher", tint: "#cfe3ff", ear: "#6a8fc4", say: "I dig through what already exists on Arc." },
  { k: "bolt", name: "Bolt", role: "Builder", tint: "#d9f2cf", ear: "#6fa35c", say: "I pack it up and send it to your Studio." },
] as const;

function Dog({ k, size = 64, wag = false }: { k: (typeof DOGS)[number]["k"]; size?: number; wag?: boolean }) {
  const d = DOGS.find((x) => x.k === k)!;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden style={wag ? { animation: "dogwag 1.6s ease-in-out infinite" } : undefined}>
      <ellipse cx="14" cy="26" rx="9" ry="15" fill={d.ear} transform="rotate(14 14 26)" />
      <ellipse cx="50" cy="26" rx="9" ry="15" fill={d.ear} transform="rotate(-14 50 26)" />
      <circle cx="32" cy="34" r="21" fill={d.tint} />
      <ellipse cx="32" cy="43" rx="10" ry="7.5" fill="#fff" opacity=".85" />
      <circle cx="24.5" cy="31" r="2.6" fill="#0b1a29" /><circle cx="39.5" cy="31" r="2.6" fill="#0b1a29" />
      <ellipse cx="32" cy="39" rx="3.4" ry="2.5" fill="#0b1a29" />
      <path d="M28 44.5q4 3.2 8 0" stroke="#0b1a29" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </svg>
  );
}

const STEPS = ["Plan", "Research", "Build"];
const stepOf = (s: Stage) => (s === "asking" ? 0 : s === "research" || s === "follow" ? 1 : s === "done" ? 2 : -1);

async function api(path: string, body?: unknown) {
  const r = await fetch(path, { method: body ? "POST" : "GET", credentials: "include", headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.error ?? "Something went wrong"), { status: r.status });
  return j;
}

export default function Dreams() {
  const [stage, setStage] = useState<Stage>("idea");
  const [idea, setIdea] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [v, setV] = useState<V | null>(null);
  const [pick, setPick] = useState<Record<string, string>>({});
  const [sheet, setSheet] = useState<{ sheet: string; command: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [hash, setHash] = useState<string | null>(null);

  useEffect(() => { // resume an unfinished dream after a reload
    const id = localStorage.getItem("dream:id"); if (!id) return;
    api(`/api/dreams/${id}`).then((x: V) => enter(x)).catch(() => localStorage.removeItem("dream:id"));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function enter(x: V) {
    setV(x); setPick({});
    if (x.status === "asking") setStage("asking");
    else if (x.status === "researched") setStage("follow");
    else if (x.status === "ready") { setStage("done"); api(`/api/dreams/${x.id}/sheet`).then(setSheet).catch(() => {}); }
    else if (x.status === "paid") void step(x.id, {});
    else if (x.status === "new") setStage("paying");
  }
  async function step(id: string, body: unknown) {
    setBusy(true); setErr(null);
    try {
      if (v?.status === "asking" || (body as { answers?: unknown }).answers) setStage("research");
      const x = await api(`/api/dreams/${id}`, body); enter(x);
    } catch (e) { setErr((e as Error).message); if (v?.status === "asking") setStage("asking"); } finally { setBusy(false); }
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
  const copy = (k: string, t: string) => { void navigator.clipboard.writeText(t); setCopied(k); setTimeout(() => setCopied(null), 1600); };
  const reset = () => { localStorage.removeItem("dream:id"); setV(null); setSheet(null); setIdea(""); setStage("idea"); setErr(null); };
  const qs = stage === "asking" ? v?.questions ?? [] : stage === "follow" ? v?.followups ?? [] : [];
  const all = qs.length > 0 && qs.every((q) => pick[q.id]);
  const dog = stage === "idea" || stage === "paying" ? "mochi" : stage === "asking" ? "mochi" : stage === "research" || stage === "follow" ? "scout" : "bolt";
  const s = stepOf(stage);

  return (
    <main className="mx-auto min-h-dvh max-w-[560px] pb-24">
      <TopBar back="/create" title="Arcdreams" right={stage !== "idea" ? <button onClick={reset} className="text-[13px] text-muted">Start over</button> : undefined} />
      <style>{`@keyframes dogwag{0%,100%{transform:rotate(-4deg)}50%{transform:rotate(5deg)}}@keyframes pop{0%{transform:scale(.92);opacity:0}100%{transform:scale(1);opacity:1}}@keyframes sniff{0%,100%{transform:translateX(0)}50%{transform:translateX(8px)}}`}</style>

      {s >= 0 && (
        <div className="px-5 pt-1">
          <div className="flex items-center gap-2">{STEPS.map((n, i) => (
            <div key={n} className="flex-1">
              <div className="h-[5px] overflow-hidden rounded-full bg-[var(--line-strong)]"><div className="h-full rounded-full bg-[var(--fg)] transition-all duration-700" style={{ width: i < s || stage === "done" ? "100%" : i === s ? "55%" : "0%" }} /></div>
              <div className={`mt-1.5 text-[11px] uppercase tracking-[0.14em] ${i <= s ? "text-fg" : "text-faint"}`}>{n}</div>
            </div>))}</div>
        </div>
      )}

      <div className="px-5 pt-5">
        <div className="flex items-center gap-4 rounded-[24px] hairline p-4" style={{ animation: "pop 400ms var(--ease-out) both" }} key={dog + stage}>
          <Dog k={dog} size={68} wag={!busy} />
          <div className="min-w-0 flex-1">
            <div className="text-[12px] uppercase tracking-[0.14em] text-faint">{DOGS.find((d) => d.k === dog)!.name} · {DOGS.find((d) => d.k === dog)!.role}</div>
            <div className="mt-1 text-[15px] leading-snug">
              {stage === "idea" && "Hi! One line about what you want to build. Make it short and clear."}
              {stage === "paying" && "Waiting for your $1 to land. This pays for our dogs' thinking."}
              {stage === "asking" && (busy ? "Hold on, sniffing out your questions…" : "Four quick picks. Tap what feels right.")}
              {stage === "research" && "Scout is digging through Arc for what fits and what could go wrong…"}
              {stage === "follow" && "Scout found gaps in the plan. Two more picks."}
              {stage === "done" && "Your Dream Sheet is ready. Time to hand it to Studio."}
            </div>
          </div>
        </div>
      </div>

      {err && <p className="mx-5 mt-4 rounded-[16px] hairline p-3 text-[13px]">{err}</p>}

      {stage === "idea" && (
        <div className="rise px-5 pt-5">
          <textarea value={idea} onChange={(e) => setIdea(e.target.value.slice(0, 280))} rows={3} placeholder="e.g. A tip jar where fans tip a creator in USDC and see a leaderboard" className="field w-full resize-none" />
          <div className="mt-1 flex justify-between text-[12px] text-faint"><span>{idea.trim().length < 12 ? "A few more words" : "Good"}</span><span>{idea.length}/280</span></div>
          <div className="mt-5 grid grid-cols-3 gap-2">{DOGS.map((d) => (
            <div key={d.k} className="rounded-[18px] hairline p-3 text-center"><div className="mx-auto w-fit"><Dog k={d.k} size={44} /></div><div className="mt-1 text-[13px] font-medium">{d.name}</div><div className="mt-0.5 text-[11px] leading-snug text-muted">{d.say}</div></div>))}
          </div>
          <button disabled={idea.trim().length < 12 || busy} onClick={begin} className="btn btn-solid mt-6 w-full">{busy ? "Opening the gate…" : "Enter the arena · $1 USDC"}</button>
          <p className="mt-3 text-center text-[12px] leading-relaxed text-faint">The $1 pays for the dogs&apos; planning and research. Your build then runs in your own Arc Studio, on testnet.</p>
        </div>
      )}

      {stage === "paying" && !hash && !busy && v?.status === "new" && <p className="px-5 pt-5 text-center text-[13px] text-muted">Approve the $1 in your wallet window.</p>}

      {(stage === "asking" || stage === "follow") && qs.length > 0 && (
        <div className="px-5 pt-4">
          {qs.map((q, qi) => (
            <div key={q.id} className="rise mb-5" style={{ animationDelay: `${qi * 90}ms` }}>
              <div className="num text-[12px] text-faint">{String(qi + 1).padStart(2, "0")}</div>
              <div className="mt-1 text-[17px] font-medium tracking-[-0.02em]">{q.text}</div>
              <div className="mt-3 grid gap-2">{q.options.map((o) => (
                <button key={o.id} onClick={() => setPick((p) => ({ ...p, [q.id]: o.id }))} className={`press rounded-[18px] border px-4 py-3.5 text-left text-[15px] transition-colors ${pick[q.id] === o.id ? "border-fg bg-[var(--fg)] text-[var(--bg)]" : "hairline"}`}>{o.label}</button>))}
              </div>
            </div>))}
          <button disabled={!all || busy} onClick={() => step(v!.id, { answers: Object.fromEntries(Object.entries(pick).map(([k, x]) => [k, { optionId: x }])) })} className="btn btn-solid w-full">{busy ? "The dogs are working…" : stage === "asking" ? "Send to Scout" : "Pack the Dream Sheet"}</button>
        </div>
      )}

      {stage === "research" && (
        <div className="flex justify-center px-5 pt-10"><div style={{ animation: "sniff 1.2s ease-in-out infinite" }}><Dog k="scout" size={96} /></div></div>
      )}

      {stage === "done" && v && (
        <div className="rise px-5 pt-5">
          {v.plan && (
            <div className="rounded-[24px] hairline p-5">
              <div className="text-[12px] uppercase tracking-[0.14em] text-faint">Plan Card</div>
              <div className="mt-1 text-[22px] font-medium tracking-[-0.02em]">{v.plan.name}</div>
              <p className="mt-1 text-[14px] text-muted">{v.plan.oneLiner}</p>
              <div className="mt-4 text-[12px] uppercase tracking-[0.14em] text-faint">Screens</div>
              <ul className="mt-1 text-[14px] leading-relaxed">{v.plan.screens.map((x) => <li key={x}>· {x}</li>)}</ul>
              <div className="mt-4 text-[12px] uppercase tracking-[0.14em] text-faint">Rules the contract holds</div>
              <ul className="mt-1 text-[14px] leading-relaxed">{v.plan.rules.map((x) => <li key={x}>· {x}</li>)}</ul>
            </div>)}
          {v.research && (
            <div className="mt-3 rounded-[24px] hairline p-5">
              <div className="text-[12px] uppercase tracking-[0.14em] text-faint">Research Card</div>
              <ul className="mt-2 text-[14px] leading-relaxed">{v.research.use.map((u) => <li key={u.piece} className="mb-1"><span className="font-medium">{u.piece}</span> <span className="text-muted">· {u.why}</span></li>)}</ul>
              {v.research.risks.length > 0 && <><div className="mt-3 text-[12px] uppercase tracking-[0.14em] text-faint">Watch out for</div><ul className="mt-1 text-[14px] leading-relaxed">{v.research.risks.map((x) => <li key={x}>· {x}</li>)}</ul></>}
              {v.skills.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{v.skills.map((k) => <span key={k} className="rounded-full hairline px-3 py-1 text-[12px]">{k}</span>)}</div>}
            </div>)}
          {sheet && (
            <div className="mt-3 rounded-[24px] hairline p-5">
              <div className="flex items-center gap-3"><Dog k="bolt" size={40} /><div><div className="text-[15px] font-medium">Bolt&apos;s hand-off</div><div className="text-[12px] text-muted">Runs in your own Arc Studio, never ours.</div></div></div>
              <ol className="mt-4 space-y-2 text-[14px] leading-relaxed text-muted">
                <li><span className="num text-fg">1.</span> Install Studio once: <code className="text-fg">npm i -g @circle-fin/arc-studio-cli</code> and run <code className="text-fg">arc-studio login</code>.</li>
                <li><span className="num text-fg">2.</span> Save the sheet as <code className="text-fg">dream.md</code> in a folder.</li>
                <li><span className="num text-fg">3.</span> Run the command below. Studio plans, audits, deploys, and builds the app.</li>
              </ol>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button onClick={() => copy("sheet", sheet.sheet)} className="btn btn-solid">{copied === "sheet" ? "Copied" : "Copy sheet"}</button>
                <button onClick={() => copy("cmd", sheet.command)} className="btn btn-ghost">{copied === "cmd" ? "Copied" : "Copy command"}</button>
              </div>
              <a className="mt-3 block text-center text-[13px] text-muted underline underline-offset-4" href={`data:text/markdown;charset=utf-8,${encodeURIComponent(sheet.sheet)}`} download="dream.md">Download dream.md</a>
              <p className="mt-3 text-[12px] leading-relaxed text-faint">Studio deploys to Arc testnet only. Review everything before using real money.</p>
            </div>)}
          <button onClick={reset} className="btn btn-ghost mt-4 w-full">Dream something else</button>
        </div>
      )}
    </main>
  );
}
