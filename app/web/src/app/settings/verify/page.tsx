"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { TopBar } from "@/components/ui";
import { Check } from "@/components/icons";

type Check = { key: string; label: string; ok: boolean; detail: string };
type Status = { checks: Check[]; meets: boolean; verified: boolean; founding: boolean; requested: boolean };

// Verified = honour and trust. Earned by record, never bought. The team reviews once every rule is met.
export default function Verify() {
  const [s, setS] = useState<Status | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const load = () => fetch("/api/verify").then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error ?? "Could not load"); setS(j); }).catch((e) => setErr((e as Error).message));
  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/set-state-in-effect
  async function request() {
    setBusy(true); setErr(null);
    const r = await fetch("/api/verify", { method: "POST" }); const j = await r.json();
    if (!r.ok) setErr(j.error ?? "Could not send"); else await load();
    setBusy(false);
  }
  const done = s?.checks.filter((c) => c.ok).length ?? 0;
  return (
    <main className="mx-auto min-h-dvh max-w-[520px] pb-16">
      <TopBar back="/settings" title="Get verified" />
      <div className="px-5">
        <div className="relative mt-2 overflow-hidden rounded-[28px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/demo/bg_blue.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-white/45" />
          <div className="relative flex flex-col items-center px-6 py-9 text-center">
            <span className="grid h-16 w-16 place-items-center rounded-full bg-black text-white">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l2.4 1.8 3 .1.9 2.9 2.4 1.8-.9 2.9.9 2.9-2.4 1.8-.9 2.9-3 .1L12 21l-2.4-1.8-3-.1-.9-2.9-2.4-1.8.9-2.9-.9-2.9 2.4-1.8.9-2.9 3-.1z" /><path d="m8.6 12.2 2.4 2.4 4.4-4.6" /></svg>
            </span>
            <div className="mt-4 font-serif text-[22px] uppercase tracking-[0.18em] text-black">{s?.verified ? "Verified" : "Verification"}</div>
            <p className="mt-2 max-w-[290px] text-[13px] leading-relaxed text-black/75">
              {s?.verified ? "You are trusted on Arctisans. Keep earning that trust." : "Verified is honour and trust. It is earned by your record and never bought."}
            </p>
          </div>
        </div>

        {s?.founding && <div className="mt-4 rounded-[18px] bg-[var(--img-bg)] px-4 py-3 text-[13px]">🌱 You are a <b>Founding member</b>, hand-picked by the team. This is a separate mark from Verified.</div>}

        {s && (
          <div className="rise mt-6">
            <div className="label">Your record · {done} of {s.checks.length}</div>
            {s.checks.map((c) => (
              <div key={c.key} className="flex items-center gap-3 border-b border-line py-3.5 text-[14px]">
                <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${c.ok ? "bg-fg text-[var(--bg)]" : "border border-dashed border-line-strong"}`}>{c.ok && <Check size={13} />}</span>
                <span className={`flex-1 ${c.ok ? "" : "text-muted"}`}>{c.label}</span>
                <span className="num text-[12px] text-faint">{c.detail}</span>
              </div>
            ))}
            {!s.checks.find((c) => c.key === "identity")?.ok && <Link href="/setup?edit=1" className="mt-3 block text-[13px] underline">Add your X or GitHub link →</Link>}
            <p className="mt-4 text-[12px] leading-relaxed text-faint">Ratings count only when they come from at least 3 different people, so one friend can&apos;t carry you. When every rule is met, the team reviews your profile and grants the seal by hand.</p>
            {s.verified ? null : s.requested ? (
              <div className="btn btn-ghost mt-5 w-full opacity-70">Sent. The team will review you.</div>
            ) : (
              <button disabled={!s.meets || busy} onClick={request} className="btn btn-solid mt-5 w-full disabled:opacity-40">{s.meets ? "Ask the team to review me" : "Meet every rule to ask for review"}</button>
            )}
          </div>
        )}
        {err && <p className="mt-4 text-center text-[13px] text-red-500">{err}</p>}
        {!s && !err && <p className="mt-8 text-center text-[13px] text-faint">Loading…</p>}
      </div>
    </main>
  );
}
