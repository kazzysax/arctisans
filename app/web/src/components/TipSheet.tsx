"use client";
import { useState } from "react";
import { Sheet } from "./ui";
import { Check } from "./icons";

const PRESETS = [1, 2, 5];
export function TipSheet({ open, onClose, name, avatar }: { open: boolean; onClose: () => void; name: string; avatar: string }) {
  const [amt, setAmt] = useState<number | null>(2);
  const [custom, setCustom] = useState("");
  const [done, setDone] = useState(false);
  const value = custom ? Number(custom) : amt ?? 0;
  const ok = value >= 0.5 && value <= 100;
  const close = () => { onClose(); setTimeout(() => setDone(false), 300); };
  return (
    <Sheet open={open} onClose={close}>
      {done ? (
        <div className="rise flex flex-col items-center py-6 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-fg text-[var(--bg)]"><Check size={24} /></span>
          <div className="num mt-5 text-[34px] font-semibold">${value.toFixed(2)}</div>
          <p className="mt-1 text-[14px] text-muted">sent to {name}. It&apos;s already in their wallet.</p>
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
          <button disabled={!ok} onClick={() => setDone(true)} className="btn btn-solid mt-6 w-full">Send ${ok ? value.toFixed(2) : "0.00"}</button>
        </>
      )}
    </Sheet>
  );
}
