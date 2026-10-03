"use client";
import { useCallback, useEffect, useRef, useState } from "react";

type Msg = { id: string; mine: boolean; body: string; at: number };
const time = (t: number) => new Date(t).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Chat between the client and the Arctisan of one job. Timestamped and permanent, so it doubles as a record if they disagree. */
export function JobChat({ jobId, otherName }: { jobId: string; otherName: string }) {
  const [msgs, setMsgs] = useState<Msg[] | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const load = useCallback(async () => {
    const r = await fetch(`/api/jobs/${jobId}/messages`, { credentials: "include" });
    if (r.ok) setMsgs(((await r.json()) as { items: Msg[] }).items);
  }, [jobId]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount, then quiet polling
  useEffect(() => { void load(); const t = setInterval(() => void load(), 6000); return () => clearInterval(t); }, [load]);
  useEffect(() => { end.current?.scrollIntoView({ block: "nearest" }); }, [msgs?.length]);
  async function send() {
    if (!text.trim() || busy) return;
    setBusy(true); setErr(null);
    const r = await fetch(`/api/jobs/${jobId}/messages`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: text }) });
    if (r.ok) { setText(""); await load(); } else setErr(((await r.json().catch(() => ({}))) as { error?: string }).error ?? "Could not send");
    setBusy(false);
  }
  return (
    <section className="mt-8">
      <h2 className="text-[15px] font-medium">Messages</h2>
      <div className="mt-3 max-h-[320px] overflow-y-auto rounded-[22px] hairline p-3">
        {msgs === null ? <p className="p-3 text-[13px] text-muted">Loading…</p> : msgs.length === 0 ? <p className="p-3 text-[13px] text-muted">Say hello to {otherName}. Messages stay on this job so you both have a record.</p> : (
          <div className="flex flex-col gap-2">
            {msgs.map((m) => (
              <div key={m.id} className={`max-w-[82%] rounded-[18px] px-3.5 py-2 text-[14px] leading-snug ${m.mine ? "self-end bg-[var(--img-bg)] text-[#0b1a29]" : "self-start bg-bg-2"}`}>
                <div className="whitespace-pre-wrap break-words">{m.body}</div>
                <div className="mt-1 text-[10.5px] opacity-50">{time(m.at)}</div>
              </div>
            ))}
            <div ref={end} />
          </div>
        )}
      </div>
      <div className="mt-2 flex gap-2">
        <input value={text} maxLength={1000} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void send()} placeholder={`Message ${otherName}`} className="field flex-1" />
        <button onClick={send} disabled={busy || !text.trim()} className="btn btn-solid px-5 disabled:opacity-40">Send</button>
      </div>
      {err && <p className="mt-2 text-[12.5px] text-red-500">{err}</p>}
    </section>
  );
}
