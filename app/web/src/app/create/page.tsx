"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/ui";
import { Plus } from "@/components/icons";

// Create: one sheet, three choices. Work post (≤3 pictures) or Request (text).
const CHOICES = [
  { id: "work", t: "Post work", d: "Up to 3 pictures of something you made" },
  { id: "request", t: "Post a request", d: "Describe a job you want done" },
  { id: "agreement", t: "Start an agreement", d: "Already found someone? Set the terms" },
] as const;

export default function Create() {
  const r = useRouter();
  const [mode, setMode] = useState<null | "work" | "request">(null);
  const [pics, setPics] = useState<string[]>([]);
  const [budget, setBudget] = useState("40");
  const sample = ["/demo/work_ankara.jpg", "/demo/work_fashion.jpg", "/demo/work_tailor.jpg"];

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
          <div>
            <div className="grid grid-cols-3 gap-2">
              {[0, 1, 2].map((i) => pics[i]
                // eslint-disable-next-line @next/next/no-img-element
                ? <button key={i} onClick={() => setPics(pics.filter((_, k) => k !== i))} className="press relative aspect-[4/5] overflow-hidden rounded-[18px] bg-[var(--img-bg)]"><img src={pics[i]} alt="" className="h-full w-full object-cover" /><span className="glass absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full text-[12px]">×</span></button>
                : <button key={i} onClick={() => setPics([...pics, sample[pics.length]])} className="press grid aspect-[4/5] place-items-center rounded-[18px] border border-dashed border-line-strong text-muted" aria-label="Add picture"><Plus size={20} /></button>)}
            </div>
            <p className="mt-2 text-[12px] text-faint">{pics.length}/3 · compressed automatically, originals never leave your phone</p>
          </div>
          <label className="flex flex-col gap-2"><span className="label">Caption</span><textarea rows={3} maxLength={500} className="field" placeholder="What did you make, and for who?" /></label>
          <label className="flex flex-col gap-2"><span className="label">Skill</span><input className="field" defaultValue="Tailoring" /></label>
          <div className="flex items-center justify-between rounded-[18px] hairline p-4"><span><span className="block text-[14px]">Open for hire</span><span className="block text-[12px] text-muted">Shows a Hire button on this post</span></span><span className="relative h-7 w-12 rounded-full bg-fg"><span className="absolute right-1 top-1 h-5 w-5 rounded-full bg-[var(--bg)]" /></span></div>
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
        <button disabled={mode === "work" && pics.length === 0} onClick={() => r.push("/social")} className="btn btn-solid w-full max-w-[440px]">{mode === "work" ? "Share" : "Post request"}</button>
      </div>
    </main>
  );
}
