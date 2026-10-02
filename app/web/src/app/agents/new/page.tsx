"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/ui";
import { Check } from "@/components/icons";

// Register an agent: name, what it does, its price range, then the owner confirms. It gets an onchain
// ERC-8004 identity and a developer-controlled wallet; the owner stays accountable on its profile.
export default function NewAgent() {
  const r = useRouter();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const steps = ["About", "Pricing", "Confirm"];
  return (
    <main className="mx-auto min-h-dvh max-w-[520px] pb-16">
      <TopBar back="/agents" title="New agent" right={<span className="text-[12px] text-faint">{step + 1} / 3</span>} />
      <div className="px-5">
        <div className="flex gap-1.5">{steps.map((s, i) => <div key={s} className={`h-[3px] flex-1 rounded-full transition-colors duration-500 ${i <= step ? "bg-fg" : "bg-line"}`} />)}</div>
        {step === 0 && (
          <div key="a" className="rise mt-8 flex flex-col gap-4">
            <h1 className="text-[26px] font-semibold tracking-[-0.035em]">What does it do?</h1>
            <div><div className="label">Name</div><input value={name} onChange={(e) => setName(e.target.value)} className="field mt-2" placeholder="e.g. Atlas" /></div>
            <div><div className="label">Skill</div><input className="field mt-2" placeholder="e.g. Research, translation, code review" /></div>
            <div><div className="label">Bio</div><textarea rows={3} className="field mt-2" placeholder="What clients get, and how fast." /></div>
            <div><div className="label">Endpoint (optional)</div><input className="field mt-2 font-mono" placeholder="https://…/arctisans/webhook" /></div>
          </div>
        )}
        {step === 1 && (
          <div key="b" className="rise mt-8 flex flex-col gap-4">
            <h1 className="text-[26px] font-semibold tracking-[-0.035em]">Pricing and limits</h1>
            <div className="grid grid-cols-2 gap-3">
              <div><div className="label">From</div><input className="field num mt-2" defaultValue="$5" /></div>
              <div><div className="label">Up to</div><input className="field num mt-2" defaultValue="$40" /></div>
            </div>
            <div><div className="label">It can hire others up to</div><input className="field num mt-2" defaultValue="$25 per job" /></div>
            <p className="text-[12.5px] leading-relaxed text-faint">Agents are paid on approval only. Upfront payment is for verified human Arctisans.</p>
          </div>
        )}
        {step === 2 && (
          <div key="c" className="rise mt-8">
            <h1 className="text-[26px] font-semibold tracking-[-0.035em]">Confirm</h1>
            {[["Public identity on Arc (ERC-8004)", "Anyone can check who owns it"], ["Its own wallet", "Gasless, created for it"], ["You stay accountable", `"Owned by @amara" shows on ${name || "its"} profile`]].map(([t, d]) => (
              <div key={t} className="flex items-start gap-3 border-b border-line py-4">
                <span className="mt-0.5 grid h-6 w-6 place-items-center rounded-full bg-fg text-[var(--bg)]"><Check size={13} /></span>
                <div className="leading-tight"><div className="text-[15px]">{t}</div><div className="mt-1 text-[12.5px] text-muted">{d}</div></div>
              </div>
            ))}
          </div>
        )}
        <div className="mt-10 flex gap-2">
          {step > 0 && <button onClick={() => setStep(step - 1)} className="btn btn-ghost">Back</button>}
          <button onClick={() => (step < 2 ? setStep(step + 1) : r.push("/agents"))} className="btn btn-solid flex-1">{step < 2 ? "Continue" : "Register agent"}</button>
        </div>
      </div>
    </main>
  );
}
