"use client";
import { LeafLoader } from "@/components/Logo";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { TopBar } from "@/components/ui";
import { Check } from "@/components/icons";

type C = { key: string; label: string; ok: boolean; detail: string };
type W = { handle: string; displayName: string; links: { label: string; url: string }[]; checks: C[]; meets: boolean };
type F = { handle: string; displayName: string; verified: boolean; founding: boolean };
type PC = { postId: string; handle: string; body: string; thumb: string | null; video: boolean };
type Req = PC & { id: string; kind: string; note: string | null; at: number };

// Team portal: review verification requests, grant or remove Verified and Founding by hand. No power over money.
export default function Team() {
  const [state, setState] = useState<"load" | "no" | "ok">("load");
  const [waiting, setWaiting] = useState<W[]>([]);
  const [found, setFound] = useState<F[]>([]);
  const [q, setQ] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [reqs, setReqs] = useState<Req[]>([]);
  const [lights, setLights] = useState<PC[]>([]);

  const load = useCallback(async (query = "") => {
    const r = await fetch(`/api/admin/verify${query ? `?q=${encodeURIComponent(query)}` : ""}`);
    if (!r.ok) { setState("no"); return; }
    const j = await r.json(); setWaiting(j.waiting); setFound(j.found); setState("ok");
    const pr = await fetch("/api/admin/posts"); if (pr.ok) { const pj = await pr.json(); setReqs(pj.requests); setLights(pj.highlights); }
  }, []);
  useEffect(() => { void load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  async function act(handle: string, action: "verify" | "unverify" | "founding" | "unfounding" | "decline" | "remove") {
    setNote(null);
    const r = await fetch("/api/admin/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ handle, action }) });
    const j = await r.json();
    setNote(r.ok ? `@${handle}: ${action} done` : j.error ?? "Failed");
    await load(q);
  }
  async function post(body: Record<string, string>, done: string) {
    setNote(null);
    const r = await fetch("/api/admin/posts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json(); setNote(r.ok ? done : j.error ?? "Failed"); await load(q);
  }
  const Thumb = ({ p }: { p: PC }) => (
    <Link href={`/p/${p.postId}`} className="flex min-w-0 flex-1 items-center gap-3">
      {p.thumb ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={p.thumb} alt="" className="h-12 w-12 shrink-0 rounded-[12px] object-cover" /> : <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[12px] bg-[var(--img-bg)] text-[11px] text-faint">{p.video ? "Video" : "Text"}</span>}
      <span className="min-w-0 text-[13px] leading-snug"><b>@{p.handle}</b><br /><span className="line-clamp-1 text-muted">{p.body || (p.video ? "Video post" : "Post")}</span></span>
    </Link>
  );
  const Btn = ({ onClick, children, solid }: { onClick: () => void; children: React.ReactNode; solid?: boolean }) => (
    <button onClick={onClick} className={`press rounded-full px-4 py-2 text-[13px] font-medium ${solid ? "bg-fg text-[var(--bg)]" : "hairline-strong"}`}>{children}</button>
  );

  if (state === "load") return <main className="grid min-h-dvh place-items-center text-fg"><LeafLoader size={64} /></main>;
  if (state === "no") return <main className="mx-auto max-w-[520px]"><TopBar back="/settings" title="Team" /><p className="px-5 pt-10 text-center text-[14px] text-muted">This page is for the Arctisans team only.</p></main>;
  return (
    <main className="mx-auto min-h-dvh max-w-[520px] pb-16">
      <TopBar back="/settings" title="Team portal" />
      <div className="px-5">
        {note && <div className="mt-2 rounded-[14px] bg-[var(--img-bg)] px-4 py-2.5 text-[13px]">{note}</div>}

        <div className="label mt-5">Waiting for review · {waiting.length}</div>
        {waiting.length === 0 && <p className="mt-2 text-[13px] text-faint">No one is waiting.</p>}
        {waiting.map((w) => (
          <div key={w.handle} className="mt-3 rounded-[22px] hairline p-4">
            <div className="flex items-center justify-between">
              <Link href={`/u/${w.handle}`} className="text-[15px] font-medium underline">{w.displayName} <span className="text-faint">@{w.handle}</span></Link>
              <span className="text-[11px] text-faint">{w.checks.filter((c) => c.ok).length}/{w.checks.length} rules</span>
            </div>
            <div className="mt-2">
              {w.checks.map((c) => (
                <div key={c.key} className="flex items-center gap-2 py-1 text-[12.5px]">
                  <span className={`grid h-4 w-4 place-items-center rounded-full ${c.ok ? "bg-fg text-[var(--bg)]" : "border border-dashed border-line-strong"}`}>{c.ok && <Check size={10} />}</span>
                  <span className={c.ok ? "" : "text-muted"}>{c.label}</span><span className="ml-auto text-faint">{c.detail}</span>
                </div>
              ))}
            </div>
            {w.links.length > 0 && <div className="mt-2 flex flex-wrap gap-x-3 text-[12px]">{w.links.map((l) => <a key={l.url} href={l.url} target="_blank" rel="noreferrer" className="underline">{l.label}</a>)}</div>}
            <div className="mt-3 flex gap-2"><Btn solid onClick={() => act(w.handle, "verify")}>Verify</Btn><Btn onClick={() => act(w.handle, "decline")}>Decline</Btn></div>
          </div>
        ))}

        <div className="label mt-8">Post requests · {reqs.length}</div>
        {reqs.length === 0 && <p className="mt-2 text-[13px] text-faint">No requests.</p>}
        {reqs.map((x) => (
          <div key={x.id} className="mt-3 rounded-[18px] hairline p-3.5">
            <div className="flex items-center gap-3"><Thumb p={x} /><span className="rounded-full bg-[var(--img-bg)] px-3 py-1 text-[11.5px] font-medium">{x.kind === "delete" ? "Delete" : "Highlight"}</span></div>
            <div className="mt-3 flex gap-2">
              <Btn solid onClick={() => post({ requestId: x.id, action: "approve" }, x.kind === "delete" ? "Post deleted" : "Added to Highlights")}>{x.kind === "delete" ? "Delete post" : "Add to Highlights"}</Btn>
              <Btn onClick={() => post({ requestId: x.id, action: "decline" }, "Declined")}>Decline</Btn>
            </div>
          </div>
        ))}

        <div className="label mt-8">In Highlights · {lights.length}</div>
        {lights.length === 0 && <p className="mt-2 text-[13px] text-faint">Nothing featured yet. Open any post and tap Add to Highlights.</p>}
        {lights.map((x) => (
          <div key={x.postId} className="mt-3 flex items-center gap-3 rounded-[18px] hairline p-3.5">
            <Thumb p={x} /><Btn onClick={() => post({ postId: x.postId, action: "unhighlight" }, "Removed from Highlights")}>Remove</Btn>
          </div>
        ))}
        <p className="mt-2 text-[12px] text-faint">Everything posted by the official @arctisans account appears in Highlights automatically.</p>

        <div className="label mt-8">Official account</div>
        <div className="mt-2 flex items-center gap-3 rounded-[20px] hairline p-4">
          <div className="flex-1 text-[13px] leading-snug">Creates the verified <b>@arctisans</b> profile (Founding, owned by you).</div>
          <button className="btn btn-solid h-9 px-4 text-[13px]" onClick={async () => { const r = await fetch("/api/admin/official", { method: "POST", credentials: "include" }); const j = await r.json(); alert(r.ok ? (j.created ? "Created @arctisans" : "@" + j.handle + " already exists") : (j.error ?? "Failed")); }}>Create</button>
        </div>

        <div className="label mt-8">Find anyone</div>
        <form onSubmit={(e) => { e.preventDefault(); void load(q); }} className="mt-2 flex gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="handle or name" className="field flex-1" />
          <button className="btn btn-solid">Search</button>
        </form>
        {found.map((f) => (
          <div key={f.handle} className="mt-3 rounded-[18px] hairline p-3.5">
            <div className="text-[14px] font-medium">{f.displayName} <span className="text-faint">@{f.handle}</span> {f.verified && "· Verified"} {f.founding && "· 🌱 Founding"}</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {f.verified ? <Btn onClick={() => act(f.handle, "unverify")}>Remove Verified</Btn> : <Btn solid onClick={() => act(f.handle, "verify")}>Verify</Btn>}
              {f.founding ? <Btn onClick={() => act(f.handle, "unfounding")}>Remove Founding</Btn> : <Btn onClick={() => act(f.handle, "founding")}>Give Founding 🌱</Btn>}
              <Btn onClick={() => { if (confirm(`Remove @${f.handle}? Only works if it has no jobs, posts or keys.`)) void act(f.handle, "remove"); }}>Remove profile</Btn>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
