"use client";
import { useCallback, useEffect, useRef, useState } from "react";

type Msg = { id: string; mine: boolean; body: string; at: number };
const time = (t: number) => new Date(t).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const day = (t: number) => new Date(t).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

/** Chat between the client and the Arctisan of one job. Timestamped and permanent, so it doubles as a record if they disagree. */
export function JobChat({ jobId, otherName }: { jobId: string; otherName: string }) {
  const [msgs, setMsgs] = useState<Msg[] | null>(null);
  const [agent, setAgent] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [waiting, setWaiting] = useState(false); // we sent something and the other side may be answering
  const [err, setErr] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const stick = useRef(true); // keep the view at the newest message unless the person scrolled up to read
  const last = useRef(0);
  const load = useCallback(async () => {
    const r = await fetch(`/api/jobs/${jobId}/messages`, { credentials: "include" });
    if (!r.ok) return;
    const j = (await r.json()) as { items: Msg[]; otherIsAgent?: boolean };
    setMsgs(j.items); setAgent(!!j.otherIsAgent);
    const newest = j.items.at(-1);
    if (newest && !newest.mine) setWaiting(false);
  }, [jobId]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount, then quiet polling (faster while waiting for a reply)
  useEffect(() => { void load(); const t = setInterval(() => { if (!document.hidden) void load(); }, waiting ? 2500 : 6000); return () => clearInterval(t); }, [load, waiting]);
  useEffect(() => {
    const el = box.current; if (!el || !msgs) return;
    if (stick.current || msgs.length !== last.current && msgs.at(-1)?.mine) el.scrollTop = el.scrollHeight;
    last.current = msgs.length;
  }, [msgs, waiting]);
  async function send() {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true); setErr(null); stick.current = true;
    const mine: Msg = { id: "tmp-" + Date.now(), mine: true, body, at: Date.now() };
    setMsgs((m) => [...(m ?? []), mine]); setText(""); // shows at once
    const r = await fetch(`/api/jobs/${jobId}/messages`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body }) }).catch(() => null);
    if (r?.ok) { setWaiting(agent); await load(); }
    else { setMsgs((m) => (m ?? []).filter((x) => x.id !== mine.id)); setText(body); setErr(((await r?.json().catch(() => ({}))) as { error?: string } | undefined)?.error ?? "Could not send. Check your connection and try again."); }
    setBusy(false);
  }
  const items = msgs ?? [];
  return (
    <section className="mt-8">
      <h2 className="text-[15px] font-medium">Messages</h2>
      {agent && <p className="mt-0.5 text-[12px] text-faint">{otherName} is an AI agent. Replies usually take under a minute.</p>}
      <div ref={box} onScroll={(e) => { const el = e.currentTarget; stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60; }} className="mt-3 max-h-[360px] min-h-[120px] overflow-y-auto rounded-[22px] hairline p-3">
        {msgs === null ? <div className="flex flex-col gap-2 p-1"><div className="skeleton h-9 w-[60%] rounded-[18px]" /><div className="skeleton ml-auto h-9 w-[45%] rounded-[18px]" /></div> : items.length === 0 ? <p className="p-3 text-[13px] leading-relaxed text-muted">Say hello to {otherName}. Add any detail that helps, such as what you want and what you have already. Messages stay on this job so you both have a record.</p> : (
          <div className="flex flex-col gap-1.5">
            {items.map((m, i) => {
              const prev = items[i - 1];
              const newDay = !prev || day(prev.at) !== day(m.at);
              const gap = prev && prev.mine === m.mine && m.at - prev.at < 120_000; // same sender, close together: tighter and no repeated time
              return (
                <div key={m.id} className="flex flex-col">
                  {newDay && <div className="my-2 self-center text-[11px] text-faint">{day(m.at)}</div>}
                  <div className={`max-w-[84%] rounded-[18px] px-3.5 py-2 text-[14px] leading-snug ${gap ? "mt-0" : "mt-1.5"} ${m.mine ? "self-end bg-[var(--img-bg)] text-[#0b1a29]" : "self-start bg-bg-2"}`}>
                    <div className="whitespace-pre-wrap break-words">{m.body}</div>
                    <div className="mt-1 text-[10.5px] opacity-50">{time(m.at)}</div>
                  </div>
                </div>
              );
            })}
            {waiting && <div className="mt-1.5 self-start rounded-[18px] bg-bg-2 px-3.5 py-2.5" aria-label={`${otherName} is typing`}><span className="inline-flex gap-1">{[0, 1, 2].map((d) => <i key={d} className="h-1.5 w-1.5 rounded-full bg-current opacity-40" style={{ animation: `pulse-dot 1s ease-in-out ${d * 0.15}s infinite` }} />)}</span></div>}
          </div>
        )}
      </div>
      <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); void send(); }}>
        <input value={text} maxLength={1000} onChange={(e) => setText(e.target.value)} enterKeyHint="send" autoComplete="off" placeholder={`Message ${otherName}`} className="field flex-1" />
        <button type="submit" disabled={busy || !text.trim()} className="btn btn-solid px-5 disabled:opacity-40">Send</button>
      </form>
      {err && <p className="mt-2 text-[12.5px] text-red-500">{err}</p>}
    </section>
  );
}
