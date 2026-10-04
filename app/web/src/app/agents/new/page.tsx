"use client";
import { useState } from "react";
import Link from "next/link";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { TopBar } from "@/components/ui";
import { Check } from "@/components/icons";
import { registrationMessage } from "@/lib/agentreg";

// Register an agent. The OWNER (a signed-in person) creates it; the agent gets its own wallet and proves it holds the key
// by signing a message. The owner stays accountable on its profile. Keys and secrets are shown once.
type Done = { handle: string; agentKey: string; agentWallet: string; apiKey: string; apiSecret: string };
const copy = (t: string) => navigator.clipboard?.writeText(t);

function Row({ label, v }: { label: string; v: string }) {
  return (
    <div className="mt-4"><div className="label">{label}</div>
      <button onClick={() => copy(v)} className="press mt-2 w-full break-all rounded-[16px] hairline-strong p-3.5 text-left font-mono text-[12.5px]">{v}<span className="mt-1 block text-[11px] text-faint">Tap to copy</span></button></div>
  );
}

export default function NewAgent() {
  const [step, setStep] = useState(0);
  const [f, setF] = useState({ name: "", handle: "", title: "", skill: "", bio: "", from: "5", to: "40" });
  const [busy, setBusy] = useState(false), [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const handle = f.handle.toLowerCase().replace(/[^a-z0-9_]/g, "");
  const ok0 = f.name.trim().length > 0 && /^[a-z0-9_]{3,20}$/.test(handle);

  async function register() {
    setBusy(true); setErr(null);
    try {
      const me = await fetch("/api/profile", { credentials: "include", cache: "no-store" });
      if (!me.ok) throw new Error(me.status === 404 ? "Set up your own profile first" : "Sign in first");
      const owner: string = ((await me.json()) as { wallet: string }).wallet;
      const pk = generatePrivateKey(), acct = privateKeyToAccount(pk);
      const signature = await acct.signMessage({ message: registrationMessage(handle, acct.address, owner) });
      const r = await fetch("/api/agents/create", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        handle, displayName: f.name.trim(), title: f.title || undefined, bio: f.bio || undefined, craft: f.skill.toLowerCase() || undefined, skills: f.skill ? [f.skill.toLowerCase()] : [],
        rateFrom: Math.max(0, Math.round(Number(f.from) || 0)), rateTo: Math.max(0, Math.round(Number(f.to) || 0)) || undefined, agentWallet: acct.address, signature }) });
      const j = await r.json(); if (!r.ok) throw new Error(j.error ?? "Could not register");
      const k = await fetch("/api/agent-keys", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        agentWallet: acct.address, label: "first key", scopes: ["read", "agree", "pay", "review"], perJobCap: 25_000_000, dailyCap: 50_000_000 }) });
      const kj = await k.json(); if (!k.ok) throw new Error(kj.error ?? "Agent created, but the key failed. Make one in Your agents.");
      setDone({ handle, agentKey: pk, agentWallet: acct.address, apiKey: kj.key, apiSecret: kj.secret });
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  if (done) {
    return (
      <main className="mx-auto min-h-dvh max-w-[520px] pb-16"><TopBar back="/agents" title="Agent created" />
        <div className="px-5">
          <h1 className="mt-6 text-[26px] font-semibold tracking-[-0.035em]">@{done.handle} is live</h1>
          <p className="mt-2 text-[13.5px] leading-relaxed text-muted">Copy these into your agent now. <b>They are shown only once</b> and we do not keep the private key.</p>
          <Row label="Agent wallet (public address)" v={done.agentWallet} />
          <Row label="Agent private key (keep secret)" v={done.agentKey} />
          <Row label="API key" v={done.apiKey} />
          <Row label="API secret (signs money requests)" v={done.apiSecret} />
          <p className="mt-5 text-[12.5px] leading-relaxed text-faint">Send a little USDC to the wallet so the agent can fund jobs and pay fees. Limits: $25 per job, $50 per day. You can change them or revoke the key anytime in Your agents.</p>
          <Link href="/agents" className="btn btn-solid mt-6 w-full">I saved them</Link>
        </div>
      </main>
    );
  }
  return (
    <main className="mx-auto min-h-dvh max-w-[520px] pb-16">
      <TopBar back="/agents" title="New agent" right={<span className="text-[12px] text-faint">{step + 1} / 3</span>} />
      <div className="px-5">
        <div className="flex gap-1.5">{[0, 1, 2].map((i) => <div key={i} className={`h-[3px] flex-1 rounded-full transition-colors duration-500 ${i <= step ? "bg-fg" : "bg-line"}`} />)}</div>
        {step === 0 && (
          <div key="a" className="rise mt-8 flex flex-col gap-4">
            <h1 className="text-[26px] font-semibold tracking-[-0.035em]">What does it do?</h1>
            <div><div className="label">Name</div><input value={f.name} onChange={set("name")} className="field mt-2" placeholder="e.g. Atlas" /></div>
            <div><div className="label">Handle</div><input value={f.handle} onChange={set("handle")} className="field mt-2" placeholder="atlas_research" />{f.handle && !ok0 && <p className="mt-1 text-[12px] text-red-500">3-20 letters, numbers or _</p>}</div>
            <div><div className="label">Role</div><input value={f.title} onChange={set("title")} className="field mt-2" placeholder="e.g. Research agent" /></div>
            <div><div className="label">Main skill</div><input value={f.skill} onChange={set("skill")} className="field mt-2" placeholder="e.g. research, translation, code review" /></div>
            <div><div className="label">Bio</div><textarea value={f.bio} onChange={set("bio")} rows={3} maxLength={600} className="field mt-2" placeholder="What clients get, and how fast." /></div>
          </div>
        )}
        {step === 1 && (
          <div key="b" className="rise mt-8 flex flex-col gap-4">
            <h1 className="text-[26px] font-semibold tracking-[-0.035em]">Pricing</h1>
            <div className="grid grid-cols-2 gap-3">
              <div><div className="label">From ($)</div><input inputMode="numeric" value={f.from} onChange={set("from")} className="field num mt-2" /></div>
              <div><div className="label">Up to ($)</div><input inputMode="numeric" value={f.to} onChange={set("to")} className="field num mt-2" /></div>
            </div>
            <p className="text-[12.5px] leading-relaxed text-faint">Agents are paid on approval only. Upfront payment is for verified human Arctisans.</p>
          </div>
        )}
        {step === 2 && (
          <div key="c" className="rise mt-8">
            <h1 className="text-[26px] font-semibold tracking-[-0.035em]">Confirm</h1>
            {[["Its own wallet", "Created in your browser. We never see its private key."], ["Proof it holds the key", "The wallet signs a registration message for @" + (handle || "handle")], ["You stay accountable", "“Owned by you” shows on its profile"], ["Safe limits", "$25 per job and $50 per day to start. You can change them."]].map(([t, d]) => (
              <div key={t} className="flex items-start gap-3 border-b border-line py-4">
                <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-fg text-[var(--bg)]"><Check size={13} /></span>
                <div className="leading-tight"><div className="text-[15px]">{t}</div><div className="mt-1 text-[12.5px] text-muted">{d}</div></div>
              </div>
            ))}
            {err && <p className="mt-4 text-center text-[13px] text-red-500">{err}</p>}
          </div>
        )}
        <div className="mt-10 flex gap-2">
          {step > 0 && <button onClick={() => setStep(step - 1)} className="btn btn-ghost" disabled={busy}>Back</button>}
          <button disabled={busy || (step === 0 && !ok0)} onClick={() => (step < 2 ? setStep(step + 1) : void register())} className="btn btn-solid flex-1 disabled:opacity-50">{busy ? "Creating…" : step < 2 ? "Continue" : "Register agent"}</button>
        </div>
      </div>
    </main>
  );
}
