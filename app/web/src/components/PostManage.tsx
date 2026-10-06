"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type S = { owner: boolean; admin: boolean; highlight: boolean; pending: string[] };

/** Under a post: the owner can ask the team to feature it or remove it. The team can do either at once. Nobody else sees anything. */
export function PostManage({ postId }: { postId: string }) {
  const [s, setS] = useState<S | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  useEffect(() => {
    fetch(`/api/posts/manage?id=${postId}`, { credentials: "include" }).then((r) => (r.ok ? r.json() : null)).then(setS).catch(() => setS(null));
  }, [postId]);
  if (!s || (!s.owner && !s.admin)) return null;

  async function ask(kind: "highlight") {
    setBusy(true); setMsg(null);
    const r = await fetch("/api/posts/manage", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ postId, kind }) });
    const j = await r.json(); setBusy(false);
    if (r.ok) { setS((v) => v && { ...v, pending: [...v.pending, kind] }); setMsg("Sent to the team. They will review it."); } else setMsg(j.error ?? "Could not send");
  }
  async function removeMine() {
    if (!confirm("Delete this post for good? Its picture or video is removed too.")) return;
    setBusy(true); setMsg(null);
    const r = await fetch("/api/posts/manage", { method: "DELETE", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ postId }) });
    const j = await r.json(); setBusy(false);
    if (r.ok) router.replace("/social"); else setMsg(j.error ?? "Could not delete");
  }
  async function act(action: "highlight" | "unhighlight" | "delete") {
    if (action === "delete" && !confirm("Delete this post for good?")) return;
    setBusy(true); setMsg(null);
    const r = await fetch("/api/admin/posts", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ postId, action }) });
    const j = await r.json(); setBusy(false);
    if (!r.ok) { setMsg(j.error ?? "Failed"); return; }
    if (action === "delete") { router.replace("/social"); return; }
    setS((v) => v && { ...v, highlight: action === "highlight" }); setMsg(action === "highlight" ? "Added to Highlights" : "Removed from Highlights");
  }
  const has = (k: string) => s.pending.includes(k);
  const b = "press rounded-full hairline-strong px-4 py-2 text-[13px] font-medium disabled:opacity-50";
  return (
    <div className="mt-5 rounded-[18px] hairline p-3.5">
      <div className="label">{s.admin ? "Team" : "Your post"}</div>
      <div className="mt-2.5 flex flex-wrap gap-2">
        {s.admin ? (
          <>
            <button disabled={busy} onClick={() => act(s.highlight ? "unhighlight" : "highlight")} className={b}>{s.highlight ? "Remove from Highlights" : "Add to Highlights"}</button>
            <button disabled={busy} onClick={() => act("delete")} className={b}>Delete post</button>
          </>
        ) : (
          <>
            {s.highlight ? <span className="rounded-full bg-[var(--img-bg)] px-4 py-2 text-[13px] font-medium">In Highlights</span>
              : <button disabled={busy || has("highlight")} onClick={() => ask("highlight")} className={b}>{has("highlight") ? "Highlight requested" : "Apply for Highlights"}</button>}
            <button disabled={busy} onClick={removeMine} className={b}>Delete post</button>
          </>
        )}
      </div>
      {msg && <p className="mt-2 text-[12.5px] text-muted">{msg}</p>}
    </div>
  );
}
