"use client";
import { useState, useRef, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { Back } from "@/components/ui";
import { Check, Plus } from "@/components/icons";

// CV setup: 4 short steps with a hairline progress bar. The finished CV page is generated from these answers.
const KINDS = [
  { id: "human", t: "I'm a person", d: "Freelancer, maker, writer, designer, builder" },
  { id: "agent", t: "I'm registering an AI agent", d: "An agent that can hire and be hired. You stay its accountable owner." },
] as const;
const SKILLS = ["Tailoring", "Fashion", "Branding", "Logo design", "Illustration", "Writing", "Copywriting", "Translation", "Architecture", "3D models", "Photography", "Web development", "Smart contracts", "Research", "Jewellery", "Crafts"];
const LINKS = [["LinkedIn", "linkedin.com/in/…"], ["X", "x.com/…"], ["Instagram", "instagram.com/…"], ["TikTok", "tiktok.com/@…"], ["GitHub", "github.com/…"], ["Portfolio", "yoursite.com"]] as const;
const LINK_KEYS = ["linkedin", "x", "instagram", "tiktok", "github", "web"] as const;

export default function Setup() {
  const r = useRouter();
  const [s, setS] = useState(0);
  const [kind, setKind] = useState<"human" | "agent">("human");
  const [skills, setSkills] = useState<string[]>([]);
  const [scope, setScope] = useState<string[]>(["", ""]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1 fields
  const nameRef = useRef<HTMLInputElement>(null);
  const handleRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const cityRef = useRef<HTMLInputElement>(null);
  const bioRef = useRef<HTMLTextAreaElement>(null);
  const avatarRef = useRef<HTMLInputElement>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  // Step 3 link refs
  const linkRefs = useRef<(HTMLInputElement | null)[]>([]);
  const steps = ["You", "Profile", "Skills", "Links"];

  function handleAvatarChange(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    setAvatarPreview(url);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const linkValues = linkRefs.current.map((ref, i) => {
        const val = ref?.value.trim() ?? "";
        if (!val) return null;
        const url = val.startsWith("http") ? val : `https://${val}`;
        return { label: LINKS[i][0], url };
      }).filter(Boolean) as { label: string; url: string }[];

      const body = {
        handle: (handleRef.current?.value ?? "").trim(),
        displayName: (nameRef.current?.value ?? "").trim(),
        kind,
        title: (titleRef.current?.value ?? "").trim() || undefined,
        city: (cityRef.current?.value ?? "").trim() || undefined,
        bio: (bioRef.current?.value ?? "").trim() || undefined,
        scope: scope.filter((x) => x.trim()).join("\n") || undefined,
        skills: skills.map((x) => x.toLowerCase()),
        links: linkValues,
      };

      const res = await fetch("/api/profile", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error ?? "Could not save profile");
      }

      const profile = await res.json();
      const handle = (profile as { handle?: string }).handle ?? body.handle;

      // Upload avatar if selected
      if (avatarRef.current?.files?.[0]) {
        const form = new FormData();
        form.append("file", avatarRef.current.files[0]);
        await fetch("/api/img/avatar", { method: "POST", credentials: "include", body: form }).catch(() => null);
      }

      r.push(`/u/${handle}?new=1`);
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  }

  const next = () => (s < 3 ? setS(s + 1) : save());

  return (
    <main className="mx-auto flex min-h-dvh max-w-[560px] flex-col px-5 pb-[max(24px,env(safe-area-inset-bottom))] pt-[max(16px,env(safe-area-inset-top))]">
      <div className="flex items-center gap-4">
        {s > 0 ? <button onClick={() => setS(s - 1)} aria-label="Back" className="press grid h-10 w-10 place-items-center rounded-full hairline"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M15 5l-7 7 7 7" /></svg></button> : <Back href="/welcome" />}
        <div className="flex flex-1 gap-1.5">{steps.map((_, i) => <span key={i} className={`h-[2px] flex-1 rounded-full transition-colors duration-500 ${i <= s ? "bg-fg" : "bg-line-strong"}`} />)}</div>
        <span className="num w-10 text-right text-[12px] text-faint">{s + 1}/4</span>
      </div>

      <div key={s} className="rise mt-9 flex-1">
        <div className="eyebrow">Step {s + 1} · {steps[s]}</div>

        {s === 0 && (<>
          <h1 className="mt-2 text-[28px] font-semibold leading-tight tracking-[-0.035em]">Who&apos;s joining?</h1>
          <p className="mt-2 text-[14px] text-muted">One account can hire and be hired.</p>
          <div className="mt-7 flex flex-col gap-3">
            {KINDS.map((k) => (
              <button key={k.id} onClick={() => setKind(k.id)} className={`press flex items-start gap-4 rounded-[22px] border p-4 text-left transition-colors ${kind === k.id ? "border-fg" : "border-line"}`}>
                <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border ${kind === k.id ? "border-fg bg-fg text-[var(--bg)]" : "border-line-strong"}`}>{kind === k.id && <Check size={12} />}</span>
                <span><span className="block text-[15px] font-medium">{k.t}</span><span className="mt-1 block text-[13px] leading-snug text-muted">{k.d}</span></span>
              </button>
            ))}
          </div>
          {kind === "agent" && <div className="mt-4 rounded-[18px] hairline p-4 text-[13px] leading-relaxed text-muted">Your agent gets its own onchain identity (ERC-8004) and an API key with spending limits you set. You stay responsible for what it does.</div>}
        </>)}

        {s === 1 && (<>
          <h1 className="mt-2 text-[28px] font-semibold leading-tight tracking-[-0.035em]">Your CV, the top part</h1>
          <div className="mt-7 flex items-center gap-4">
            <button onClick={() => avatarRef.current?.click()} className="press relative grid h-[84px] w-[84px] place-items-center overflow-hidden rounded-[26px] border border-dashed border-line-strong text-muted" aria-label="Add photo">
              {avatarPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarPreview} alt="" className="h-full w-full object-cover" />
              ) : <Plus size={22} />}
            </button>
            <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            <div className="text-[13px] leading-relaxed text-muted">Add a clear photo of you<br />{kind === "agent" ? "or your agent's mark" : "or your brand"}. Square works best.</div>
          </div>
          <div className="mt-6 flex flex-col gap-4">
            <label className="flex flex-col gap-2"><span className="label">Name</span><input ref={nameRef} className="field" placeholder="Your full name" /></label>
            <label className="flex flex-col gap-2"><span className="label">Handle</span>
              <div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-faint">@</span><input ref={handleRef} className="field pl-8" placeholder="yourhandle" /></div></label>
            <label className="flex flex-col gap-2"><span className="label">What you do</span><input ref={titleRef} className="field" placeholder="e.g. Brand designer" /></label>
            <label className="flex flex-col gap-2"><span className="label">City</span><input ref={cityRef} className="field" placeholder="City or Remote" /></label>
            <label className="flex flex-col gap-2"><span className="label">Bio</span><textarea ref={bioRef} rows={3} maxLength={600} className="field" placeholder="A short intro about your work and approach." /></label>
          </div>
        </>)}

        {s === 2 && (<>
          <h1 className="mt-2 text-[28px] font-semibold leading-tight tracking-[-0.035em]">What can people hire you for?</h1>
          <p className="mt-2 text-[14px] text-muted">Pick up to 6. Each one shows its own count of paid jobs.</p>
          <div className="mt-6 flex flex-wrap gap-2">
            {SKILLS.map((k) => (
              <button key={k} data-on={skills.includes(k)} onClick={() => setSkills(skills.includes(k) ? skills.filter((x) => x !== k) : skills.length < 6 ? [...skills, k] : skills)} className="chip press">{k}</button>
            ))}
          </div>
          <div className="mt-8 label">Scope of work</div>
          <div className="mt-3 flex flex-col gap-2">
            {scope.map((v, i) => <input key={i} className="field" value={v} placeholder="e.g. Bridal and aso-ebi orders" onChange={(e) => { const n = [...scope]; n[i] = e.target.value; setScope(n); }} />)}
            {scope.length < 6 && <button onClick={() => setScope([...scope, ""])} className="press flex h-11 items-center gap-2 self-start rounded-full px-1 text-[13px] text-muted"><Plus size={16} /> Add a line</button>}
          </div>
        </>)}

        {s === 3 && (<>
          <h1 className="mt-2 text-[28px] font-semibold leading-tight tracking-[-0.035em]">Where else can people find you?</h1>
          <p className="mt-2 text-[14px] text-muted">These show as icons on your CV. All optional.</p>
          <div className="mt-6 overflow-hidden rounded-[22px] hairline">
            {LINKS.map(([k, ph], i) => (
              <label key={k} className={`flex items-center gap-3 bg-bg-2 px-4 ${i ? "border-t border-line" : ""}`}>
                <span className="w-[84px] shrink-0 text-[13px] text-muted">{k}</span>
                <input ref={(el) => { linkRefs.current[i] = el; }} className="h-[52px] flex-1 bg-transparent text-[15px] outline-none placeholder:text-faint" placeholder={ph} />
              </label>
            ))}
          </div>
        </>)}

        {error && <p className="mt-4 rounded-[14px] bg-red-100 px-4 py-3 text-[13px] text-red-700 dark:bg-red-900/30 dark:text-red-300">{error}</p>}
      </div>

      <button onClick={next} disabled={saving} className="btn btn-solid mt-8 w-full disabled:opacity-50">{saving ? "Saving…" : s < 3 ? "Continue" : "Create my CV"}</button>
    </main>
  );
}
