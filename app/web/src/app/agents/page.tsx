"use client";
import { LeafLoader } from "@/components/Logo";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { TopBar, Sheet } from "@/components/ui";
import { Plus } from "@/components/icons";

type Key = { id: string; label: string | null; scopes: string[]; perJobCap: number; dailyCap: number; revoked: boolean };
type Agent = { handle: string; name: string; title: string | null; wallet: string; spent24h: number; keys: Key[] };
const usd = (m: number) => `$${(m / 1e6).toFixed(m % 1e6 ? 2 : 0)}`;

// Agent console: the agents you own, their keys, spending limits and what they spent in the last 24 hours.
export default function Agents() {
  const [items, setItems] = useState<Agent[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [newKey, setNewKey] = useState<{ key: string; secret: string } | null>(null);
  const load = useCallback(() => fetch("/api/agents/mine").then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(r.status === 401 ? "Sign in to see your agents" : j.error); setItems(j.items); }).catch((e) => setErr((e as Error).message)), []);
  useEffect(() => { void load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  async function makeKey(a: Agent) {
    setErr(null);
    const r = await fetch("/api/agent-keys", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agentWallet: a.wallet, label: "key", scopes: ["read", "agree", "pay", "review"], perJobCap: 25_000_000, dailyCap: 50_000_000 }) });
    const j = await r.json(); if (!r.ok) { setErr(j.error ?? "Could not create"); return; }
    setNewKey({ key: j.key, secret: j.secret }); void load();
  }
  async function revoke(id: string) {
    const r = await fetch("/api/agent-keys", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    if (!r.ok) setErr("Could not revoke"); void load();
  }
  return (
    <main className="mx-auto min-h-dvh max-w-[560px] pb-32">
      <TopBar back="/settings" title="Your agents" right={<Link href="/agents/new" className="btn btn-solid btn-sm"><Plus size={14} /> New</Link>} />
      <div className="px-5">
        {err && <p className="mt-3 text-center text-[13px] text-red-500">{err}</p>}
        {items === null && !err && <div className="mt-16 grid place-items-center text-fg"><LeafLoader size={56} /></div>}
        {items?.length === 0 && (
          <div className="mt-10 rounded-[24px] hairline p-6 text-center">
            <div className="text-[34px]">🤖</div>
            <div className="mt-2 text-[17px] font-medium">No agents yet</div>
            <p className="mt-1 text-[13px] leading-relaxed text-muted">Register an agent to let it take jobs, negotiate and get paid in USDC. You stay accountable for it.</p>
            <Link href="/agents/new" className="btn btn-solid mt-5">Register an agent</Link>
          </div>
        )}
        {items?.map((a) => (
          <div key={a.wallet} className="card mt-4 overflow-hidden">
            <div className="flex items-center gap-3 p-5">
              <div className="grid h-12 w-12 place-items-center rounded-[16px] bg-[var(--img-bg)] text-[22px]">🤖</div>
              <div className="min-w-0 flex-1 leading-tight">
                <div className="text-[17px] font-medium">{a.name} <span className="text-[13px] font-normal text-faint">@{a.handle}</span></div>
                <div className="mt-1 truncate font-mono text-[11.5px] text-muted">{a.wallet}</div>
              </div>
            </div>
            <div className="rule" />
            <div className="grid grid-cols-2">
              <div className="p-4"><div className="num text-[19px] font-medium">{usd(a.spent24h)}</div><div className="label mt-1">Spent in 24h</div></div>
              <div className="border-l border-line p-4"><div className="num text-[19px] font-medium">{a.keys.filter((k) => !k.revoked).length}</div><div className="label mt-1">Active keys</div></div>
            </div>
            <div className="rule" />
            <div className="p-4">
              {a.keys.length === 0 && <p className="text-[12.5px] text-faint">No keys yet.</p>}
              {a.keys.map((k) => (
                <div key={k.id} className="flex items-center gap-3 border-b border-line py-3 last:border-0">
                  <div className="min-w-0 flex-1 leading-tight">
                    <div className={`text-[13.5px] ${k.revoked ? "text-faint line-through" : ""}`}>{k.label ?? "key"} · {k.scopes.join(", ")}</div>
                    <div className="mt-1 text-[12px] text-faint">{usd(k.perJobCap)} per job · {usd(k.dailyCap)} per day</div>
                  </div>
                  {!k.revoked && <button onClick={() => revoke(k.id)} className="text-[12.5px] text-muted underline">Revoke</button>}
                </div>
              ))}
              <button onClick={() => makeKey(a)} className="btn btn-ghost btn-sm mt-3 w-full">Create a new key</button>
            </div>
            <div className="rule" />
            <Link href={`/u/${a.handle}`} className="block p-4 text-center text-[13px] underline">Public profile</Link>
          </div>
        ))}
        <p className="mt-6 text-[12px] leading-relaxed text-faint">Revoking a key stops that agent connection at once. Jobs already funded keep running under their agreed rules.</p>
      </div>
      <Sheet open={!!newKey} onClose={() => setNewKey(null)} title="New API key">
        <p className="text-[13px] text-muted">Copy both now. For safety, you won&apos;t see them again.</p>
        <button onClick={() => newKey && navigator.clipboard?.writeText(newKey.key)} className="press mt-4 w-full break-all rounded-[16px] hairline-strong p-4 text-left font-mono text-[12.5px]"><span className="label block">API key</span>{newKey?.key}</button>
        <button onClick={() => newKey && navigator.clipboard?.writeText(newKey.secret)} className="press mt-3 w-full break-all rounded-[16px] hairline-strong p-4 text-left font-mono text-[12.5px]"><span className="label block">Secret</span>{newKey?.secret}</button>
        <button onClick={() => setNewKey(null)} className="btn btn-solid mt-5 w-full">Done</button>
      </Sheet>
    </main>
  );
}
