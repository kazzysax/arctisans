"use client";
import { useState } from "react";
import { encodeFunctionData, erc20Abi, isAddress } from "viem";
import { Sheet } from "./ui";
import { USDC } from "@/lib/chain";
import { sendCalls } from "@/lib/walletClient";

/** Add funds: your Arc address to send USDC to, with copy. */
export function ReceiveSheet({ open, onClose, wallet }: { open: boolean; onClose: () => void; wallet: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => { try { await navigator.clipboard.writeText(wallet); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch {} };
  return (
    <Sheet open={open} onClose={onClose} title="Add funds">
      <p className="text-[14px] leading-relaxed text-muted">Send <b className="text-fg">USDC on Arc</b> to this address from an exchange or another wallet. Other networks will not arrive.</p>
      <div className="mt-5 rounded-[20px] bg-[var(--img-bg)] p-4 text-[#0b1a29]">
        <div className="text-[11px] uppercase tracking-[0.18em] opacity-60">Your Arc wallet</div>
        <div className="mt-2 break-all font-mono text-[15px] leading-relaxed">{wallet}</div>
      </div>
      <button onClick={copy} className="btn btn-solid mt-5 w-full">{copied ? "Copied" : "Copy address"}</button>
      <a href={`https://explorer.arc.io/address/${wallet}`} target="_blank" rel="noreferrer" className="mt-4 block text-center text-[13px] text-muted underline underline-offset-4">View on Arc explorer</a>
    </Sheet>
  );
}

/** Withdraw: send USDC from your wallet to any Arc address. You approve it in Circle's window. */
export function WithdrawSheet({ open, onClose, balance, onDone }: { open: boolean; onClose: () => void; balance: number | null; onDone: () => void }) {
  const [to, setTo] = useState("");
  const [amt, setAmt] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [hash, setHash] = useState<string | null | undefined>(undefined);
  const units = Math.round(Number(amt) * 1e6);
  const valid = isAddress(to) && units > 0 && (balance === null || units <= balance);
  async function send() {
    setErr(null); setBusy(true);
    try {
      const data = encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [to as `0x${string}`, BigInt(units)] });
      setHash(await sendCalls([{ to: USDC, data, label: "Send USDC" }]));
      onDone();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  const close = () => { onClose(); setTimeout(() => { setHash(undefined); setErr(null); }, 300); };
  return (
    <Sheet open={open} onClose={close} title="Withdraw">
      {hash !== undefined ? (
        <div className="text-center">
          <div className="text-[34px] font-semibold tracking-[-0.03em]">${(units / 1e6).toFixed(2)}</div>
          <p className="mt-1 text-[14px] text-muted">sent on Arc.</p>
          {hash && <a href={`https://explorer.arc.io/tx/${hash}`} target="_blank" rel="noreferrer" className="mt-4 block text-[13px] text-muted underline underline-offset-4">View receipt</a>}
          <button onClick={close} className="btn btn-ghost mt-6 w-full">Done</button>
        </div>
      ) : (
        <>
          <label className="text-[12px] uppercase tracking-[0.14em] text-faint">To (Arc address)</label>
          <input value={to} onChange={(e) => setTo(e.target.value.trim())} placeholder="0x…" className="mt-2 h-12 w-full rounded-[16px] border border-line bg-transparent px-4 font-mono text-[14px] outline-none focus:border-fg" />
          <label className="mt-4 block text-[12px] uppercase tracking-[0.14em] text-faint">Amount (USDC)</label>
          <div className="mt-2 flex gap-2">
            <input value={amt} onChange={(e) => setAmt(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" placeholder="0.00" className="h-12 flex-1 rounded-[16px] border border-line bg-transparent px-4 text-[16px] outline-none focus:border-fg" />
            {balance !== null && <button onClick={() => setAmt((balance / 1e6).toString())} className="chip press">Max</button>}
          </div>
          <p className="mt-2 text-[12px] text-faint">Available: {balance === null ? "—" : `$${(balance / 1e6).toFixed(2)}`}. Only send to an address on Arc.</p>
          {err && <p className="mt-3 text-[13px] text-red-500">{err}</p>}
          <button disabled={!valid || busy} onClick={send} className="btn btn-solid mt-5 w-full disabled:opacity-40">{busy ? "Approve in Circle…" : "Send"}</button>
        </>
      )}
    </Sheet>
  );
}
