"use client";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { TopBar } from "@/components/ui";
import { people } from "@/lib/demo";

const noop = () => () => {};
const Row = ({ href, title, sub, right }: { href?: string; title: string; sub?: string; right?: React.ReactNode }) => {
  const body = (<><div className="flex-1 leading-tight"><div className="text-[15px]">{title}</div>{sub && <div className="mt-1 text-[12.5px] text-muted">{sub}</div>}</div>{right ?? (href && <span className="text-faint">→</span>)}</>);
  return href ? <Link href={href} className="press flex items-center gap-3 border-b border-line py-4">{body}</Link> : <div className="flex items-center gap-3 border-b border-line py-4">{body}</div>;
};

export default function Settings() {
  const me = people.amara;
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const t = mounted ? theme ?? "system" : "dark";
  return (
    <main className="mx-auto min-h-dvh max-w-[560px] pb-28">
      <TopBar back="/u/me" title="Settings" />
      <div className="px-5">
        <Link href="/setup" className="press mt-2 flex items-center gap-4 rounded-[24px] hairline p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={me.avatar} alt="" className="h-14 w-14 rounded-[17px] object-cover" />
          <div className="flex-1 leading-tight"><div className="text-[16px] font-medium">{me.name}</div><div className="mt-1 text-[12.5px] text-muted">@{me.handle} · Edit profile and CV</div></div>
          <span className="text-faint">→</span>
        </Link>

        <div className="eyebrow mt-8">Account</div>
        <Row href="/settings/verify" title="Verification" sub="Prove you own a public account" right={<span className="rounded-full bg-fg px-2.5 py-1 text-[11px] font-medium text-[var(--bg)]">Verified</span>} />
        <Row title="Sign-in" sub="amara@… · Google" />
        <Row title="Wallet" sub="0x8f3e…21c4 · Circle smart wallet on Arc" right={<span className="text-[12px] text-faint">Gasless</span>} />
        <Row href="/agents" title="Your agents" sub="Register and manage AI agents" />

        <div className="eyebrow mt-8">Appearance</div>
        <div className="mt-3 grid grid-cols-3 gap-1 rounded-full hairline p-1">
          {["light", "dark", "system"].map((k) => (
            <button key={k} onClick={() => setTheme(k)} className={`h-10 rounded-full text-[13px] capitalize transition-colors ${t === k ? "bg-pill font-medium text-pill-fg" : "text-muted"}`}>{k}</button>
          ))}
        </div>

        <div className="eyebrow mt-8">Money</div>
        <Row title="Fees" sub="Arctisans takes nothing. Network gas is sponsored, so it's free for you." />
        <Row title="Upfront payments" sub="Trusted: up to 30% · Pro: up to 50%. You are Pro." />
        <Row title="Withdraw to an exchange or wallet" sub="Send USDC anywhere on Arc" right={<span className="text-faint">→</span>} />

        <div className="eyebrow mt-8">About</div>
        <Row title="How escrow and settlement work" sub="The rules every agreement follows" right={<span className="text-faint">→</span>} />
        <Row title="Contracts on Arc" sub="Escrow, social, identity: all public" right={<span className="text-faint">↗</span>} />

        <Link href="/signup" className="btn btn-ghost mt-10 w-full">Sign out</Link>
        <p className="mt-4 text-center text-[11.5px] text-faint">Arctisans v1 · USDC on Arc</p>
      </div>
    </main>
  );
}
