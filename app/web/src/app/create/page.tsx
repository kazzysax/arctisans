"use client";
import { useState, useRef, ChangeEvent } from "react";
import { upload } from "@vercel/blob/client";
import { CRAFTS } from "@/lib/crafts";
import { VIDEO_MAX_BYTES, VIDEO_MAX_SECONDS, VIDEO_TYPES } from "@/lib/video";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/ui";
import { Plus } from "@/components/icons";

// Create: one sheet, three choices. Work post (≤3 pictures) or Request (text).
const CHOICES = [
  { id: "work", t: "Post work", d: "Up to 3 pictures, or a short video (30s)" },
  { id: "request", t: "Post a request", d: "Describe a job you want done" },
  { id: "agreement", t: "Start an agreement", d: "Already found someone? Set the terms" },
] as const;

export default function Create() {
  const r = useRouter();
  const [mode, setMode] = useState<null | "work" | "request">(null);
  const [pics, setPics] = useState<{ file: File; url: string }[]>([]);
  const [vid, setVid] = useState<{ file: File; url: string; secs: number } | null>(null);
  const [caption, setCaption] = useState("");
  const [skill, setSkill] = useState<string>(CRAFTS[0].one);
  const [budget, setBudget] = useState("40");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const picIn = useRef<HTMLInputElement>(null), vidIn = useRef<HTMLInputElement>(null);

  function addPics(e: ChangeEvent<HTMLInputElement>) {
    const fs = [...(e.target.files ?? [])].filter((f) => /^image\/(jpeg|png|webp)$/.test(f.type)).slice(0, 3 - pics.length);
    setPics([...pics, ...fs.map((file) => ({ file, url: URL.createObjectURL(file) }))]); setVid(null); e.target.value = "";
  }
  function addVideo(e: ChangeEvent<HTMLInputElement>) {
    setErr(null);
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    if (!VIDEO_TYPES.includes(f.type)) { setErr("Use an MP4, MOV or WebM video."); return; }
    if (f.size > VIDEO_MAX_BYTES) { setErr(`Video must be under ${VIDEO_MAX_BYTES / 1024 / 1024} MB.`); return; }
    const url = URL.createObjectURL(f), v = document.createElement("video");
    v.preload = "metadata"; v.src = url;
    v.onloadedmetadata = () => {
      if (v.duration > VIDEO_MAX_SECONDS + 0.5) { setErr(`Keep it to ${VIDEO_MAX_SECONDS} seconds or less (this one is ${Math.round(v.duration)}s).`); URL.revokeObjectURL(url); return; }
      setVid({ file: f, url, secs: Math.round(v.duration) }); setPics([]);
    };
    v.onerror = () => { setErr("Could not read that video."); URL.revokeObjectURL(url); };
  }
  async function share() {
    setErr(null);
    const fd = new FormData();
    fd.append("feed", "work"); fd.append("body", caption.trim()); fd.append("skill", skill);
    try {
      if (vid) {
        setBusy("Uploading video… 0%");
        const ext = vid.file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "mp4";
        const b = await upload(`videos/clip.${ext}`, vid.file, { access: "public", handleUploadUrl: "/api/upload/video", contentType: vid.file.type, onUploadProgress: (p) => setBusy(`Uploading video… ${Math.round(p.percentage)}%`) });
        fd.append("video", b.url);
      } else pics.forEach((p) => fd.append("images", p.file));
      setBusy("Posting…");
      const r2 = await fetch("/api/posts", { method: "POST", credentials: "include", body: fd });
      const j = await r2.json().catch(() => ({}));
      if (r2.status === 401) throw new Error("Please sign in to post.");
      if (!r2.ok) throw new Error((j as { error?: string }).error ?? "Could not post");
      r.push(`/p/${(j as { id: string }).id}`);
    } catch (e) { setErr((e as Error).message); setBusy(null); }
  }

  if (!mode) return (
    <main className="mx-auto min-h-dvh max-w-[560px]">
      <TopBar back="/social" title="Create" />
      <div className="flex flex-col gap-3 px-5 pt-3">
        {CHOICES.map((c, i) => {
          const body = (<>
            <span className="num text-[12px] text-faint">{String(i + 1).padStart(2, "0")}</span>
            <span className="flex-1"><span className="block text-[17px] font-medium tracking-[-0.02em]">{c.t}</span><span className="mt-1 block text-[13px] text-muted">{c.d}</span></span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-faint"><path d="M9 5l7 7-7 7" /></svg>
          </>);
          const cls = "rise press flex items-center gap-4 rounded-[24px] hairline p-5 text-left";
          return c.id === "agreement"
            ? <Link key={c.id} href="/hire/lena" className={cls} style={{ animationDelay: `${i * 70}ms` }}>{body}</Link>
            : <button key={c.id} onClick={() => setMode(c.id)} className={cls} style={{ animationDelay: `${i * 70}ms` }}>{body}</button>;
        })}
      </div>
    </main>
  );

  return (
    <main className="mx-auto min-h-dvh max-w-[560px] pb-32">
      <TopBar title={mode === "work" ? "Post work" : "Post a request"} right={<button onClick={() => setMode(null)} className="text-[13px] text-muted">Cancel</button>} />
      <div className="rise flex flex-col gap-6 px-5 pt-2">
        {mode === "work" ? (<>
          <input ref={picIn} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={addPics} />
          <input ref={vidIn} type="file" accept="video/mp4,video/quicktime,video/webm" hidden onChange={addVideo} />
          <div>
            {vid ? (
              <div className="relative aspect-[4/5] overflow-hidden rounded-[22px] bg-black">
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <video src={vid.url} muted loop playsInline autoPlay className="h-full w-full object-cover" />
                <span className="glass absolute left-3 top-3 rounded-full px-2.5 py-1 text-[12px]">{vid.secs}s video</span>
                <button onClick={() => setVid(null)} aria-label="Remove video" className="glass press absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full">×</button>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {[0, 1, 2].map((i) => pics[i]
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <button key={i} onClick={() => setPics(pics.filter((_, k) => k !== i))} className="press relative aspect-[4/5] overflow-hidden rounded-[18px] bg-[var(--img-bg)]"><img src={pics[i].url} alt="" className="h-full w-full object-cover" /><span className="glass absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full text-[12px]">×</span></button>
                  : <button key={i} onClick={() => picIn.current?.click()} className="press grid aspect-[4/5] place-items-center rounded-[18px] border border-dashed border-line-strong text-muted" aria-label="Add picture"><Plus size={20} /></button>)}
              </div>
            )}
            <div className="mt-3 flex items-center justify-between">
              <p className="text-[12px] text-faint">{vid ? "1 video · up to 30s, 20 MB" : `${pics.length}/3 pictures · compressed automatically`}</p>
              {!vid && <button onClick={() => vidIn.current?.click()} className="chip press flex items-center gap-1.5"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="6" width="13" height="12" rx="3" /><path d="M16 10.5l5-3v9l-5-3z" /></svg>Add video</button>}
            </div>
          </div>
          <label className="flex flex-col gap-2"><span className="label">Caption</span><textarea rows={3} maxLength={500} value={caption} onChange={(e) => setCaption(e.target.value)} className="field" placeholder="What did you make, and for who?" /></label>
          <div className="flex flex-col gap-2"><span className="label">Craft</span>
            <div className="flex flex-wrap gap-2">{CRAFTS.map((c) => <button key={c.id} onClick={() => setSkill(c.one)} data-on={skill === c.one} className="chip press" style={skill === c.one ? undefined : { background: c.tint, color: "#0b1a29", borderColor: "transparent" }}>{c.one}</button>)}</div>
          </div>
          {err && <p className="text-[13px] text-red-500">{err}</p>}
        </>) : (<>
          <label className="flex flex-col gap-2"><span className="label">What do you need</span><input className="field" placeholder="e.g. Logo for a bakery" defaultValue="Logo for a bakery in Ibadan" /></label>
          <label className="flex flex-col gap-2"><span className="label">Details</span><textarea rows={5} maxLength={1200} className="field" defaultValue="Warm, simple mark. Must work on bags and a shop sign. 2 concepts, 1 revision." /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-2"><span className="label">Budget</span><div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-faint">$</span><input inputMode="decimal" className="field num pl-8" value={budget} onChange={(e) => setBudget(e.target.value.replace(/[^\d.]/g, ""))} /></div></label>
            <label className="flex flex-col gap-2"><span className="label">Needed by</span><input className="field" defaultValue="In 10 days" /></label>
          </div>
          <div className="flex flex-col gap-2"><span className="label">Who can apply</span>
            <div className="flex gap-2"><span className="chip" data-on="true">People</span><span className="chip" data-on="true">Agents</span></div></div>
        </>)}
      </div>
      <div className="fixed bottom-0 left-[var(--rail)] right-[var(--aside)] z-40 flex justify-center bg-gradient-to-t from-[var(--bg)] via-[var(--bg)] to-transparent px-5 pb-[max(18px,env(safe-area-inset-bottom))] pt-8">
        <button disabled={mode === "work" && ((pics.length === 0 && !vid) || !!busy)} onClick={() => (mode === "work" ? share() : r.push("/social"))} className="btn btn-solid w-full max-w-[440px] disabled:opacity-50">{mode === "work" ? busy ?? "Share" : "Post request"}</button>
      </div>
    </main>
  );
}
