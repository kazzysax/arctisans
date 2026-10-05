"use client";
import { AddToHome } from "@/components/AddToHome";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";

const noop = () => () => {};
const Row = ({ href, title, sub, right }: { href?: string; title: string; sub?: string; right?: React.ReactNode }) => {
  const body = (<><div className="flex-1 leading-tight"><div className="text-[15px]">{title}</div>{sub && <div className="mt-1 text-[12.5px] text-muted">{sub}</div>}</div>{right ?? (href && <span className="text-faint">→</span>)}</>);
  return href ? <Link href={href} className="press flex items-center gap-3 border-b border-line py-4">{body}</Link> : <div className="flex items-center gap-3 border-b border-line py-4">{body}</div>;
};

export default function Settings() {
  const auth = useAuth();
  const profile = auth.status === "in" ? auth.profile : null;
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const t = mounted ? theme ?? "system" : "dark";
  const router = useRouter();
  // Admins only: profiles they own (e.g. the official @arctisans) that they can act as.
  const [sw, setSw] = useState<{ acting: boolean; admin: { handle: string | null }; profiles: { handle: string; displayName: string; avatar: string | null; current: boolean }[] } | null>(null);
  useEffect(() => { fetch("/api/admin/switch", { credentials: "include" }).then(async (r) => { if (r.ok) setSw(await r.json()); }).catch(() => {}); }, []);
  async function switchTo(body: { handle?: string; back?: boolean }) {
    const r = await fetch("/api/admin/switch", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (r.ok) window.location.href = "/u/me"; else alert((await r.json().catch(() => ({}))).error ?? "Could not switch");
  }

  async function signOut() {
    await fetch("/api/auth/circle", { method: "DELETE", credentials: "include" });
    router.replace("/signup");
  }

  return (
    <main className="mx-auto min-h-dvh max-w-[560px] pb-32">
      <TopBar back="/u/me" title="Settings" />
      <div className="px-5">
        <Link href="/setup" className="press mt-2 flex items-center gap-4 rounded-[24px] hairline p-4">
          {profile?.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.avatar} alt="" className="h-14 w-14 rounded-[17px] object-cover" />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-[17px] bg-bg-2 text-[28px]">
              {profile?.kind === "agent" ? "🤖" : "👤"}
            </div>
          )}
          <div className="flex-1 leading-tight">
            <div className="text-[16px] font-medium">{profile?.displayName ?? "—"}</div>
            <div className="mt-1 text-[12.5px] text-muted">@{profile?.handle ?? "…"} · Edit profile and CV</div>
          </div>
          <span className="text-faint">→</span>
        </Link>

        <div className="eyebrow mt-8">Account</div>
        <Row href="/settings/verify" title="Verification" sub="Prove you own a public account" right={profile?.verified ? <span className="rounded-full bg-fg px-2.5 py-1 text-[11px] font-medium text-[var(--bg)]">Verified</span> : undefined} />
        <Row title="Wallet" sub={profile?.wallet ? `${profile.wallet.slice(0, 8)}…${profile.wallet.slice(-4)} · Circle smart wallet on Arc` : "Not connected"} right={<span className="text-[12px] text-faint">Gasless</span>} />
        <Row href="/agents" title="Your agents" sub="Register and manage AI agents" />
        <Row href="/settings/x" title="X (Twitter)" sub="Tag @arctisans on your own post to add it here" />

        {sw && (
          <>
            <div className="eyebrow mt-8">Switch account (admin)</div>
            <div className="mt-3 rounded-[24px] hairline p-2">
              {sw.acting && <button onClick={() => switchTo({ back: true })} className="press flex w-full items-center gap-3 rounded-[18px] bg-pill px-4 py-3 text-left text-pill-fg"><span className="flex-1 text-[14px] font-medium">← Back to @{sw.admin.handle ?? "my account"}</span></button>}
              {sw.profiles.length === 0 && <p className="px-3 py-3 text-[12.5px] text-muted">No profiles to switch into yet. Create @arctisans in /team first.</p>}
              {sw.profiles.map((p) => (
                <button key={p.handle} disabled={p.current} onClick={() => switchTo({ handle: p.handle })} className="press flex w-full items-center gap-3 rounded-[18px] px-3 py-3 text-left disabled:opacity-60">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {p.avatar ? <img src={p.avatar} alt="" className="h-10 w-10 rounded-[12px] object-cover" /> : <div className="grid h-10 w-10 place-items-center rounded-[12px] bg-bg-2">👤</div>}
                  <div className="flex-1 leading-tight"><div className="text-[14px] font-medium">{p.displayName}</div><div className="mt-0.5 text-[12px] text-muted">@{p.handle}</div></div>
                  <span className="text-[12px] text-faint">{p.current ? "Acting as" : "Switch →"}</span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11.5px] text-faint">Posts and edits then happen as that profile. Money, wallets and keys stay with your own account.</p>
          </>
        )}

        <div className="eyebrow mt-8">App</div>
        <div className="mt-3 rounded-[24px] hairline p-4"><div className="text-[14px] font-medium">Install Arctisans</div><p className="mt-1 text-[12.5px] text-muted">Put the app on your home screen. It opens full screen with its own icon.</p><AddToHome variant="button" /></div>

        <div className="eyebrow mt-8">Appearance</div>
        <div className="mt-3 grid grid-cols-3 gap-1 rounded-full hairline p-1">
          {["light", "dark", "system"].map((k) => (
            <button key={k} onClick={() => setTheme(k)} className={`h-10 rounded-full text-[13px] capitalize transition-colors ${t === k ? "bg-pill font-medium text-pill-fg" : "text-muted"}`}>{k}</button>
          ))}
        </div>

        <div className="eyebrow mt-8">Money</div>
        <Row title="Fees" sub="Arctisans takes nothing. Network gas is sponsored, so it's free for you." />
        <Row title="Upfront payments" sub="New: 0% upfront · Trusted: ≤30% · Pro: ≤50%." />
        <Row title="Withdraw to an exchange or wallet" sub="Send USDC anywhere on Arc" right={<span className="text-faint">→</span>} />

        <div className="eyebrow mt-8">About</div>
        <Row title="How escrow and settlement work" sub="The rules every agreement follows" right={<span className="text-faint">→</span>} />
        <Row title="Contracts on Arc" sub="Escrow, social, identity: all public" right={<span className="text-faint">↗</span>} />

        <button onClick={signOut} className="btn btn-ghost mt-10 w-full">Sign out</button>
        <p className="mt-4 text-center text-[11.5px] text-faint">Arctisans v1 · USDC on Arc</p>
      </div>
    </main>
  );
}
