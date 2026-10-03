"use client";
import { useEffect, useRef, useState } from "react";
import { VIDEO_MAX_BYTES, VIDEO_MAX_SECONDS } from "@/lib/video";

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}.${Math.floor((s % 1) * 10)}`;
const MIN_LEN = 1;

/**
 * Trim a long video on the phone before posting. Drag the two handles to pick up to 30 seconds; the preview loops that part.
 * Trimming and shrinking happen in the browser (nothing is uploaded until you confirm), and the file is kept under the size limit.
 */
export function VideoTrimmer({ file, onCancel, onDone }: { file: File; onCancel: () => void; onDone: (f: File, secs: number) => void }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { const u = URL.createObjectURL(file); setUrl(u); return () => URL.revokeObjectURL(u); }, [file]); // eslint-disable-line react-hooks/set-state-in-effect
  const vref = useRef<HTMLVideoElement>(null), track = useRef<HTMLDivElement>(null);
  const [dur, setDur] = useState(0);
  const [dim, setDim] = useState<[number, number]>([0, 0]);
  const [start, setStart] = useState(0), [end, setEnd] = useState(0);
  const [busy, setBusy] = useState<number | null>(null); // 0..1 while trimming
  const [err, setErr] = useState<string | null>(null);
  const cancelRef = useRef<{ cancel: () => Promise<void> } | null>(null);

  const startRef = useRef(0), endRef = useRef(0);
  useEffect(() => { startRef.current = start; endRef.current = end; }, [start, end]);

  function onMeta() {
    const v = vref.current!;
    if (!isFinite(v.duration) || v.duration <= 0) { setErr("Could not read that video."); return; }
    setDur(v.duration); setDim([v.videoWidth, v.videoHeight]);
    setStart(0); setEnd(Math.min(v.duration, VIDEO_MAX_SECONDS));
  }
  // loop the chosen part
  function onTime() {
    const v = vref.current!;
    if (v.currentTime >= endRef.current || v.currentTime < startRef.current - 0.3) v.currentTime = startRef.current;
  }
  const seek = (t: number) => { const v = vref.current; if (v) v.currentTime = t; };

  function drag(which: "start" | "end") {
    return (e: React.PointerEvent) => {
      e.preventDefault();
      const el = track.current!; el.setPointerCapture?.(e.pointerId);
      const move = (ev: PointerEvent) => {
        const r = el.getBoundingClientRect();
        const t = Math.min(dur, Math.max(0, ((ev.clientX - r.left) / r.width) * dur));
        if (which === "start") {
          const s = Math.min(t, endRef.current - MIN_LEN);
          setStart(Math.max(0, s));
          if (endRef.current - s > VIDEO_MAX_SECONDS) setEnd(s + VIDEO_MAX_SECONDS);
          seek(Math.max(0, s));
        } else {
          const en = Math.max(t, startRef.current + MIN_LEN);
          setEnd(Math.min(dur, en));
          if (en - startRef.current > VIDEO_MAX_SECONDS) setStart(en - VIDEO_MAX_SECONDS);
          seek(Math.max(0, Math.min(dur, en) - 1.5));
        }
      };
      const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); vref.current?.play().catch(() => {}); seek(startRef.current); };
      window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
    };
  }

  const len = end - start;
  const untouched = dur > 0 && start < 0.05 && end >= dur - 0.05 && dur <= VIDEO_MAX_SECONDS + 0.5 && file.size <= VIDEO_MAX_BYTES;

  async function confirm() {
    setErr(null);
    if (untouched) { onDone(file, Math.round(dur)); return; }
    setBusy(0);
    try {
      const mb = await import("mediabunny");
      const input = new mb.Input({ source: new mb.BlobSource(file), formats: mb.ALL_FORMATS });
      const target = new mb.BufferTarget();
      const output = new mb.Output({ format: new mb.Mp4OutputFormat(), target });
      // keep the result under the size limit: leave 20% headroom and 128 kbps for sound
      const vbits = Math.max(300_000, Math.min(5_000_000, Math.floor((VIDEO_MAX_BYTES * 8 * 0.8) / len) - 128_000));
      const long = Math.max(dim[0], dim[1]);
      const k = long > 1280 ? 1280 / long : 1;
      const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);
      const conv = await mb.Conversion.init({
        input, output, trim: { start, end },
        video: { bitrate: vbits, ...(k < 1 ? { width: even(dim[0] * k), height: even(dim[1] * k), fit: "contain" as const } : {}) },
        audio: { bitrate: 128_000 },
      });
      if (!conv.isValid) throw new Error("This phone can't process that video format. Try a different video.");
      cancelRef.current = conv;
      conv.onProgress = (p: number) => setBusy(p);
      await conv.execute();
      const buf = target.buffer;
      if (!buf) throw new Error("Trimming failed. Try again.");
      if (buf.byteLength > VIDEO_MAX_BYTES) throw new Error("Still too big after trimming. Pick a shorter part.");
      onDone(new File([buf], "clip.mp4", { type: "video/mp4" }), Math.round(len));
    } catch (e) {
      const m = (e as Error).message;
      setErr(/cancel/i.test(m) ? null : m || "Trimming failed. Try again.");
      setBusy(null);
    }
  }

  const pct = (t: number) => (dur ? (t / dur) * 100 : 0);
  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-[var(--bg)]">
      <div className="mx-auto flex h-full w-full max-w-[560px] flex-col px-5 pb-[max(18px,env(safe-area-inset-bottom))] pt-[max(16px,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between">
          <button onClick={() => { void cancelRef.current?.cancel(); onCancel(); }} className="text-[14px] text-muted">Cancel</button>
          <div className="text-[16px] font-medium tracking-[-0.01em]">Trim video</div>
          <span className="w-[46px]" />
        </div>

        <div className="relative mt-4 min-h-0 flex-1 overflow-hidden rounded-[24px] bg-black">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video ref={vref} src={url ?? undefined} autoPlay muted loop={false} playsInline onLoadedMetadata={onMeta} onTimeUpdate={onTime} onEnded={() => { seek(startRef.current); void vref.current?.play(); }} onError={() => setErr("Could not read that video. Try an MP4.")} className="h-full w-full object-contain" />
          {busy !== null && (
            <div className="absolute inset-0 grid place-items-center bg-black/65 text-white">
              <div className="text-center">
                <div className="num text-[34px] font-semibold">{Math.round(busy * 100)}%</div>
                <div className="mt-1 text-[13px] text-white/70">Trimming on your phone…</div>
              </div>
            </div>
          )}
        </div>

        {dur > 0 && (
          <div className="mt-5">
            <div ref={track} className="relative h-14 touch-none select-none rounded-[14px] bg-bg-2">
              <div className="absolute inset-y-0 rounded-[14px] border-2 border-[#0b1a29] bg-[var(--img-bg)]/70 dark:border-white" style={{ left: `${pct(start)}%`, width: `${pct(end) - pct(start)}%` }} />
              {(["start", "end"] as const).map((w) => (
                <div key={w} onPointerDown={drag(w)} role="slider" aria-label={w === "start" ? "Start" : "End"} aria-valuenow={Math.round(w === "start" ? start : end)}
                  className="absolute inset-y-[-4px] z-10 w-6 -translate-x-1/2 cursor-ew-resize" style={{ left: `${pct(w === "start" ? start : end)}%` }}>
                  <span className="absolute inset-y-0 left-1/2 w-[6px] -translate-x-1/2 rounded-full bg-[#0b1a29] dark:bg-white" />
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-between text-[12px] text-muted">
              <span className="num">{fmt(start)}</span>
              <span className="num font-medium text-fg">{Math.round(len)}s selected · max {VIDEO_MAX_SECONDS}s</span>
              <span className="num">{fmt(end)}</span>
            </div>
            <p className="mt-1 text-center text-[11.5px] text-faint">Video is {fmt(dur)} long. Drag the handles to choose the part to post.</p>
          </div>
        )}
        {err && <p className="mt-3 text-center text-[13px] text-red-500">{err}</p>}
        <button disabled={dur === 0 || busy !== null} onClick={confirm} className="btn btn-solid mt-4 w-full disabled:opacity-50">{busy !== null ? "Trimming…" : untouched ? "Use this video" : `Use this ${Math.round(len)}s clip`}</button>
      </div>
    </div>
  );
}
