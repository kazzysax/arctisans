"use client";
import { useState } from "react";
import { Sheet } from "./ui";
import { CoinDrop } from "./fun/CoinDrop";
import { sendCalls, circleReady, type Call } from "@/lib/walletClient";

const PRESETS = [1, 2, 5];
export function TipSheet({ open, onClose, name, avatar, to, postId }: { open: boolean; onClose: () => void; name: string; avatar: string; to?: string; postId?: string }) {
  const [amt, setAmt] = useState<number | null>(2);
  const [custom, setCustom] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const value = custom ? Number(custom) : amt ?? 0;
  const ok = value >= 0.5 && value <= 100;
  async function send() {
    setErr(null);
    if (!to || !circleReady()) { setDone(true); return; } // demo path: no wallet to charge
    setBusy(true);
    try {
      const res = await fetch("/api/tip", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to, amount: Math.round(value * 1e6), ...(postId ? { postId } : {}) }) });
      const j = await res.json();
      if (res.status === 401) { setErr("Please sign in to send a tip."); return; }
      if (!res.ok) throw new Error(j.error ?? "Could not send the tip");
      await sendCalls(j.calls as Call[]);
      setDone(true);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  const close = () => { onClose(); setTimeout(() => setDone(false), 300); };
  return (
    <Sheet open={open} onClose={close}>
      {done ? (
        <div className="flex flex-col items-center pb-2 text-center">
          <CoinDrop k={1} avatar={avatar} amount={value} />
          <p className="mt-1 text-[14px] text-muted" style={{ animation: "rise 500ms var(--ease-out) 1050ms both" }}>sent to {name}. It&apos;s already in their wallet.</p>
          <a className="mt-5 text-[13px] text-muted underline underline-offset-4" href="#">View receipt on Arc</a>
          <button onClick={close} className="btn btn-ghost mt-7 w-full">Done</button>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={avatar} alt="" className="h-11 w-11 rounded-[14px] object-cover" />
            <div><div className="text-[17px] font-medium tracking-[-0.02em]">Tip {name.split(" ")[0]}</div><div className="text-[12px] text-muted">Goes straight to their wallet · USDC on Arc</div></div>
          </div>
          <div className="mt-6 grid grid-cols-3 gap-2">
            {PRESETS.map((p) => (
              <button key={p} onClick={() => { setAmt(p); setCustom(""); }} className={`press num h-[64px] rounded-[18px] border text-[22px] font-medium transition-colors ${!custom && amt === p ? "border-fg bg-fg text-[var(--bg)]" : "border-line"}`}>${p}</button>
            ))}
          </div>
          <div className="relative mt-2">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-faint">$</span>
            <input inputMode="decimal" placeholder="Other amount" value={custom} onChange={(e) => setCustom(e.target.value.replace(/[^\d.]/g, ""))} className="field num pl-8" />
          </div>
          <p className="mt-2 text-[12px] text-faint">Minimum $0.50. No fee.</p>
          {err && <p className="mt-3 text-[13px] text-fg">{err}</p>}
          <button disabled={!ok || busy} onClick={send} className="btn btn-solid mt-6 w-full">{busy ? "Waiting for approval…" : `Send $${ok ? value.toFixed(2) : "0.00"}`}</button>
        </>
      )}
    </Sheet>
  );
}
