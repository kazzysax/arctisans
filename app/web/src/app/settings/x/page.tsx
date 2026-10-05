"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { TopBar } from "@/components/ui";

type Status = { enabled: boolean; bot: string; link: { username: string; linkedAt: number } | null };
type Bot = { connected: boolean; handle: string; lastReply?: string };

function XSettings() {
  const sp = useSearchParams();
  const [s, setS] = useState<Status | null>(null);
  const [err, setErr] = useState<string | null>(sp.get("error"));
  const [busy, setBusy] = useState(false);
  const [botInfo, setBot] = useState<Bot | null>(null); // only admins get this
  const load = () => fetch("/api/x/link", { credentials: "include" }).then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error ?? "Could not load"); setS(j); }).catch((e) => setErr((e as Error).message));
  useEffect(() => { void load(); fetch("/api/x/bot", { credentials: "include" }).then(async (r) => { if (r.ok) setBot(await r.json()); }).catch(() => {}); }, []); // eslint-disable-line react-hooks/set-state-in-effect
  async function connectBot() {
    setBusy(true); setErr(null);
    const r = await fetch("/api/x/bot?start=1", { credentials: "include" }); const j = await r.json();
    if (!r.ok) { setErr(j.error ?? "Could not start"); setBusy(false); return; }
    window.location.href = j.url;
  }
  async function link() {
    setBusy(true); setErr(null);
    const r = await fetch("/api/x/link?start=1", { credentials: "include" }); const j = await r.json();
    if (!r.ok) { setErr(j.error ?? "Could not start"); setBusy(false); return; }
    window.location.href = j.url;
  }
  async function unlinkX() {
    setBusy(true); await fetch("/api/x/link", { method: "DELETE", credentials: "include" }); await load(); setBusy(false);
  }
  const bot = s?.bot ?? "arctisans";
  const linked = sp.get("linked");
  return (
    <main className="mx-auto min-h-dvh max-w-[520px] pb-16">
      <TopBar back="/settings" title="X (Twitter)" />
      <div className="px-5">
        <div className="relative mt-2 overflow-hidden rounded-[28px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/demo/bg_leaf_blue.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-white/50" />
          <div className="relative flex flex-col items-center px-6 py-9 text-center text-black">
            <span className="grid h-16 w-16 place-items-center rounded-full bg-black text-white">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.9 2H22l-7.6 8.7L23 22h-6.8l-5.3-6.9L4.8 22H1.7l8.1-9.3L1 2h7l4.8 6.3L18.9 2zm-1.2 18h1.9L7.4 3.9H5.4L17.7 20z" /></svg>
            </span>
            <div className="mt-4 font-serif text-[22px] uppercase tracking-[0.18em]">Post from X</div>
            <p className="mt-2 max-w-[300px] text-[13px] leading-relaxed text-black/75">Post your work on X, add <b>@{bot} post this</b>, and it lands on your Arctisans profile.</p>
          </div>
        </div>

        {linked && <p className="mt-5 rounded-[18px] bg-bg-2 px-4 py-3 text-[13.5px]">Linked to @{linked}. You&apos;re all set.</p>}
        {err && <p className="mt-5 rounded-[18px] bg-bg-2 px-4 py-3 text-[13.5px]">{err}</p>}

        <div className="mt-6 rounded-[24px] hairline p-5">
          {!s ? <div className="h-12 animate-pulse rounded-full bg-bg-2" /> : !s.enabled ? (
            <p className="text-[13.5px] text-muted">Coming soon: X linking is being switched on.</p>
          ) : s.link ? (
            <div className="flex items-center gap-3">
              <div className="flex-1 leading-tight"><div className="text-[15px] font-medium">@{s.link.username}</div><div className="mt-1 text-[12.5px] text-muted">Linked {new Date(s.link.linkedAt).toLocaleDateString()}</div></div>
              <button disabled={busy} onClick={unlinkX} className="btn btn-ghost h-10 px-4 text-[13px]">Unlink</button>
            </div>
          ) : (
            <button disabled={busy} onClick={link} className="btn btn-solid w-full">{busy ? "Opening X…" : "Link my X account"}</button>
          )}
        </div>

        {botInfo && (
          <div className="mt-4 rounded-[24px] hairline p-5">
            <div className="text-[15px] font-medium">Admin: @{botInfo.handle} replies</div>
            <p className="mt-1 text-[12.5px] text-muted">{sp.get("bot") ? `Connected as @${sp.get("bot")}.` : botInfo.connected ? "Connected. The bot can reply on X." : "Not connected. Sign in to X as the bot account once, so it can reply."}</p>
            {botInfo.lastReply && <p className="mt-2 break-words text-[11.5px] text-faint">Last reply on X: {botInfo.lastReply}</p>}
            {!sp.get("bot") && <button disabled={busy} onClick={connectBot} className="btn btn-solid mt-3 w-full">{botInfo.connected ? "Reconnect" : "Connect"} @{botInfo.handle}</button>}
          </div>
        )}

        <div className="eyebrow mt-8">How it works</div>
        <ol className="mt-3 space-y-3 text-[14px] leading-relaxed">
          <li><b>1.</b> Post your work on X, with pictures or a video if you have them.</li>
          <li><b>2.</b> In the post, or in a reply to your own post, write <b>@{bot} post this</b>.</li>
          <li><b>3.</b> Within about a minute it shows on your profile, linked back to X.</li>
        </ol>
        <div className="eyebrow mt-8">Only your original posts</div>
        <ul className="mt-3 space-y-2 text-[13.5px] leading-relaxed text-muted">
          <li>· It must be posted by the X account you linked. Tagging us on someone else&apos;s post does nothing.</li>
          <li>· No retweets, no quotes, no replies to other people&apos;s posts.</li>
          <li>· Pictures or a video you uploaded are shown. A text-only post is fine too.</li>
          <li>· Each post is added once. Copied work can be reported and hidden.</li>
        </ul>
      </div>
    </main>
  );
}
export default function Page() { return <Suspense><XSettings /></Suspense>; }
