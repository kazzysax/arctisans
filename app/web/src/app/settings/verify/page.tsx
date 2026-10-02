"use client";
import { useState } from "react";
import { TopBar } from "@/components/ui";
import { SocialIcon } from "@/components/Social";
import { Check } from "@/components/icons";

// Verification: prove you own a public account by posting a one-time code from it. Unlocks the Verified badge,
// which (with your job record) opens the path to upfront payments.
const CODE = "arc-7Q4K-M2";
export default function Verify() {
  const [kind, setKind] = useState<"x" | "github" | null>(null);
  const [step, setStep] = useState<"pick" | "post" | "checking" | "done">("pick");
  const [copied, setCopied] = useState(false);
  return (
    <main className="mx-auto min-h-dvh max-w-[520px] pb-16">
      <TopBar back="/settings" title="Get verified" />
      <div className="px-5">
        <div className="relative mt-2 overflow-hidden rounded-[28px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/demo/bg_blue.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-white/45" />
          <div className="relative flex flex-col items-center px-6 py-9 text-center">
            <span className="grid h-16 w-16 place-items-center rounded-full bg-black text-white" style={{ animation: step === "done" ? "sealIn 700ms var(--spring) both" : undefined }}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l2.4 1.8 3 .1.9 2.9 2.4 1.8-.9 2.9.9 2.9-2.4 1.8-.9 2.9-3 .1L12 21l-2.4-1.8-3-.1-.9-2.9-2.4-1.8.9-2.9-.9-2.9 2.4-1.8.9-2.9 3-.1z" />{step === "done" && <path d="M8.5 12.2l2.4 2.4 4.6-4.8" />}</svg>
            </span>
            <div className="mt-4 font-serif text-[22px] uppercase tracking-[0.18em] text-black">{step === "done" ? "Verified" : "Verification"}</div>
            <p className="mt-2 max-w-[280px] text-[13px] leading-relaxed text-black/75">{step === "done" ? "Your badge is live. Upfront payments unlock at Trusted: 5 paid jobs for 3 different clients." : "Prove a public account is yours. It takes a minute and never asks for a password."}</p>
          </div>
        </div>

        {step === "pick" && (
          <div className="rise mt-6 flex flex-col gap-3">
            {([["x", "X (Twitter)", "Post a short tweet with your code"], ["github", "GitHub", "Create a public gist with your code"]] as const).map(([k, t, d]) => (
              <button key={k} onClick={() => { setKind(k); setStep("post"); }} className="press flex items-center gap-4 rounded-[22px] hairline p-4 text-left">
                <span className="grid h-11 w-11 place-items-center rounded-[14px] hairline"><SocialIcon kind={k} /></span>
                <div className="flex-1 leading-tight"><div className="text-[15px] font-medium">{t}</div><div className="mt-1 text-[12.5px] text-muted">{d}</div></div>
                <span className="text-faint">→</span>
              </button>
            ))}
          </div>
        )}

        {(step === "post" || step === "checking") && (
          <div className="rise mt-6">
            <div className="label">1 · Copy your code</div>
            <button onClick={() => { navigator.clipboard?.writeText(CODE); setCopied(true); }} className="press mt-2 flex w-full items-center justify-between rounded-[18px] hairline-strong px-4 py-4">
              <span className="num font-mono text-[20px] tracking-[0.08em]">{CODE}</span><span className="text-[12px] text-muted">{copied ? "Copied" : "Copy"}</span>
            </button>
            <div className="label mt-6">2 · {kind === "x" ? "Post it from your X account" : "Put it in a public gist"}</div>
            <a href={kind === "x" ? `https://x.com/intent/post?text=${encodeURIComponent(`Verifying my Arctisans profile: ${CODE}`)}` : "https://gist.github.com"} target="_blank" rel="noreferrer" className="btn btn-ghost mt-2 w-full">{kind === "x" ? "Open X" : "Open GitHub Gist"}</a>
            <div className="label mt-6">3 · Paste the link</div>
            <input className="field mt-2" placeholder={kind === "x" ? "https://x.com/you/status/…" : "https://gist.github.com/you/…"} />
            <button onClick={() => { setStep("checking"); setTimeout(() => setStep("done"), 1400); }} className="btn btn-solid mt-5 w-full">{step === "checking" ? <span className="inline-flex items-center gap-2"><span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent" style={{ animation: "spin .8s linear infinite" }} />Checking</span> : "Check"}</button>
          </div>
        )}

        {step === "done" && (
          <div className="rise mt-6">
            {[["Verified", true], ["5 paid jobs", false], ["3 different clients", false], ["Never abandoned a job", true]].map(([t, ok]) => (
              <div key={String(t)} className="flex items-center gap-3 border-b border-line py-3.5 text-[14px]">
                <span className={`grid h-6 w-6 place-items-center rounded-full ${ok ? "bg-fg text-[var(--bg)]" : "border border-dashed border-line-strong"}`}>{ok && <Check size={13} />}</span>
                <span className={ok ? "" : "text-muted"}>{String(t)}</span>
              </div>
            ))}
            <p className="mt-3 text-[12px] text-faint">Trusted unlocks up to 30% upfront. Pro (20 jobs, 10 clients) unlocks 50%.</p>
          </div>
        )}
      </div>
    </main>
  );
}
