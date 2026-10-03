"use client";
import { useState, useRef, useEffect, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { Back } from "@/components/ui";
import { Check, Plus } from "@/components/icons";
import { LeafLoader } from "@/components/Logo";
import { CraftArt } from "@/components/CraftArt";
import { CRAFTS, type CraftId } from "@/lib/crafts";
import { useAuth } from "@/hooks/useAuth";

// CV setup (and edit). Six short steps; the printed-style CV page is generated from these answers.
const KINDS = [
  { id: "human", t: "I'm a person", d: "Freelancer, writer, designer, builder, moderator" },
  { id: "agent", t: "I'm registering an AI agent", d: "An agent that can hire and be hired. You stay its accountable owner." },
] as const;
const YEARS = ["Under 1", "1–3", "3–5", "5+"] as const;
const DELIVERY = ["Under 24h", "2–3 days", "About a week", "2+ weeks"] as const;
const AVAIL = [["open", "Open to work"], ["limited", "Limited"], ["booked", "Booked"]] as const;
const SCOPE: Record<CraftId, string[]> = {
  writing: ["X threads", "Blog posts", "Docs & whitepapers", "Website copy", "Newsletters", "Video scripts", "Ghostwriting"],
  design: ["Logos & brand", "Website / app UI", "Pitch decks", "Banners & social", "Merch", "Icons"],
  development: ["Smart contracts", "dApp front-end", "Bots & scripts", "Audits & reviews", "Integrations", "Landing pages"],
  moderation: ["Discord moderation", "Telegram moderation", "Server setup", "Anti-scam & safety", "Night shifts", "Support tickets"],
  community: ["Community management", "AMAs & Spaces", "Events", "Ambassador programs", "Engagement campaigns", "Reports"],
  marketing: ["Launch campaigns", "KOL outreach", "Social media management", "Growth strategy", "Partnerships", "Analytics"],
  video: ["Explainer videos", "Short-form edits", "Motion graphics", "Trailers", "Animated logos", "Subtitles"],
  illustration: ["NFT collections", "Characters & mascots", "Stickers & emotes", "3D art", "Covers & posters", "PFPs"],
  research: ["Project research", "Tokenomics", "Market reports", "On-chain data", "Due diligence", "Competitor analysis"],
  translation: ["Docs translation", "Social posts", "Website localisation", "Subtitles", "Native-language support", "Proofreading"],
};
const TOOLS = ["Figma", "Canva", "Notion", "Discord", "Telegram", "Solidity", "Foundry", "React", "After Effects", "CapCut", "Blender", "Dune", "Google Sheets", "Photoshop"];
const LINKS = [["X", "x.com/…"], ["LinkedIn", "linkedin.com/in/…"], ["GitHub", "github.com/…"], ["Behance", "behance.net/… or dribbble.com/…"], ["Telegram", "t.me/…"], ["Website", "yoursite.com"]] as const;
const STEPS = ["You", "Identity", "Profile", "Scope", "Proof", "Links"];

type Piece = { img: string; caption: string; busy?: boolean };
type Existing = {
  handle: string; displayName: string; kind: "human" | "agent"; ownerWallet: string | null; title: string | null; bio: string | null;
  scope: string | null; links: { label: string; url: string }[]; avatar: string | null; cover?: string | null;
  cv?: { craft?: string; years?: string; rate?: number; delivery?: string; availability?: string; tools?: string[]; clients?: string[]; portfolio?: { img: string; caption?: string }[] };
};

async function upload(file: File, to: string) {
  const form = new FormData();
  form.append("file", file);
  const r = await fetch(to, { method: "POST", credentials: "include", body: form });
  if (!r.ok) throw new Error("Upload failed. Try a smaller picture.");
  return r.json();
}

export default function Setup() {
  const r = useRouter();
  const auth = useAuth();
  const editing = auth.status === "in";
  const [s, setS] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"form" | "building" | "ready">("form");

  // Every field lives in state: each step remounts, so anything held only in the DOM would be lost.
  const [kind, setKind] = useState<"human" | "agent">("human");
  const [ownerWallet, setOwnerWallet] = useState("");
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [title, setTitle] = useState("");
  const [craft, setCraft] = useState<CraftId | "">("");
  const [bio, setBio] = useState("");
  const [years, setYears] = useState("");
  const [scope, setScope] = useState<string[]>([]);
  const [custom, setCustom] = useState("");
  const [rate, setRate] = useState("");
  const [delivery, setDelivery] = useState("");
  const [avail, setAvail] = useState<"open" | "limited" | "booked">("open");
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [tools, setTools] = useState<string[]>([]);
  const [toolIn, setToolIn] = useState("");
  const [clients, setClients] = useState("");
  const [links, setLinks] = useState<string[]>(() => LINKS.map(() => ""));
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const avatarRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const pieceRef = useRef<HTMLInputElement>(null);
  const handleOk = /^[a-z0-9_]{3,20}$/.test(handle);

  // Editing: start from the saved CV.
  const loaded = useRef(false);
  useEffect(() => {
    if (!editing || loaded.current) return;
    loaded.current = true;
    fetch("/api/profile", { credentials: "include", cache: "no-store" }).then((x) => x.json()).then((p: Existing) => {
      setKind(p.kind); setOwnerWallet(p.ownerWallet ?? ""); setName(p.displayName); setHandle(p.handle); setTitle(p.title ?? "");
      setBio(p.bio ?? ""); setScope(p.scope ? p.scope.split("\n").filter(Boolean) : []);
      setAvatarPreview(p.avatar); setCoverPreview(p.cover ?? null);
      const cv = p.cv ?? {};
      if (cv.craft && CRAFTS.some((c) => c.id === cv.craft)) setCraft(cv.craft as CraftId);
      setYears(cv.years ?? ""); setRate(cv.rate ? String(cv.rate) : ""); setDelivery(cv.delivery ?? "");
      if (cv.availability === "open" || cv.availability === "limited" || cv.availability === "booked") setAvail(cv.availability);
      setTools(cv.tools ?? []); setClients((cv.clients ?? []).join(", "));
      setPieces((cv.portfolio ?? []).map((x) => ({ img: x.img, caption: x.caption ?? "" })));
      setLinks(LINKS.map(([k]) => p.links.find((l) => l.label.toLowerCase() === k.toLowerCase())?.url.replace(/^https?:\/\//, "") ?? ""));
    }).catch(() => null);
  }, [editing]);

  const pick = (set: (f: File) => void, preview: (u: string) => void) => (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return; set(f); preview(URL.createObjectURL(f)); e.target.value = "";
  };

  async function addPiece(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f || pieces.length >= 3) return;
    const local = URL.createObjectURL(f);
    setPieces((p) => [...p, { img: local, caption: "", busy: true }]);
    try {
      const j = (await upload(f, "/api/img/upload")) as { url: string };
      setPieces((p) => p.map((x) => (x.img === local ? { ...x, img: j.url, busy: false } : x)));
    } catch (err) {
      setPieces((p) => p.filter((x) => x.img !== local));
      setError((err as Error).message);
    }
  }

  async function save() {
    setPhase("building");
    setError(null);
    const started = Date.now();
    try {
      const body = {
        handle: handle.trim(), displayName: name.trim(), kind,
        ownerWallet: kind === "agent" ? ownerWallet.trim() : undefined,
        title: title.trim() || undefined, bio: bio.trim() || undefined,
        scope: scope.join("\n") || undefined,
        skills: [...scope, ...tools].slice(0, 12).map((x) => x.toLowerCase().slice(0, 30)),
        links: links.map((raw, i) => {
          const v = raw.trim(); if (!v) return null;
          return { label: LINKS[i][0], url: v.startsWith("http") ? v : `https://${v}` };
        }).filter(Boolean),
        cv: {
          craft: craft || undefined, years: years || undefined, rate: rate ? Math.round(Number(rate)) : undefined,
          delivery: delivery || undefined, availability: avail, tools,
          clients: clients.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 8),
          portfolio: pieces.filter((p) => !p.busy && !p.img.startsWith("blob:")).map((p) => ({ img: p.img, caption: p.caption.trim() || undefined })),
        },
      };
      const res = await fetch("/api/profile", { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error ?? "Could not save your CV");
      }
      const saved = ((await res.json()) as { handle?: string }).handle ?? body.handle;
      if (avatarFile) await upload(avatarFile, "/api/img/avatar").catch(() => null);
      if (coverFile) await upload(coverFile, "/api/img/avatar?slot=cover").catch(() => null);
      await auth.refresh?.(); // the app now knows you're signed in, so no second sign-in
      await new Promise((ok) => setTimeout(ok, Math.max(0, 2200 - (Date.now() - started))));
      setPhase("ready");
      await new Promise((ok) => setTimeout(ok, 1300));
      r.replace(`/u/${saved}`);
    } catch (e) {
      setError((e as Error).message);
      setPhase("form");
    }
  }

  const next = () => {
    if (s === 1) {
      if (!name.trim()) return setError("Add your name to continue.");
      if (!handleOk) return setError("Pick a handle: 3 to 20 lowercase letters, numbers or _.");
      if (!title.trim()) return setError("Add a one-line headline.");
      if (!craft) return setError("Pick your main craft.");
      if (kind === "agent" && !/^0x[a-fA-F0-9]{40}$/.test(ownerWallet.trim())) return setError("Add the owner's wallet address (0x…).");
    }
    if (s === 2 && !bio.trim()) return setError("Add a short bio.");
    if (s === 3 && scope.length === 0) return setError("Pick at least one thing you take on.");
    if (s === 4 && pieces.some((p) => p.busy)) return setError("Wait for your pictures to finish uploading.");
    setError(null);
    if (s < STEPS.length - 1) setS(s + 1); else void save();
  };

  async function logOut() {
    await fetch("/api/auth/circle", { method: "DELETE", credentials: "include" });
    await auth.refresh?.();
    r.replace("/signup");
  }

  if (phase !== "form") {
    return (
      <main className="grid min-h-dvh place-items-center bg-[var(--bg)] px-8 text-center">
        <div className="flex flex-col items-center">
          <div className="grid h-[132px] w-[132px] place-items-center rounded-[36%] bg-[var(--img-bg)] text-[#0b1a29] shadow-[0_24px_60px_-20px_rgba(70,130,190,0.6)]">
            {phase === "building" ? <LeafLoader size={92} /> : <LeafLoader size={92} progress={1} className="leaf-done" />}
          </div>
          <div key={phase} className="rise mt-8">
            <h1 className="text-[24px] font-semibold tracking-[-0.03em]">{phase === "building" ? (editing ? "Updating your Arctisan profile" : "Building your Arctisan profile") : "Ready"}</h1>
            <p className="mt-2 text-[14px] text-muted">{phase === "building" ? "Setting up your CV, photo and links…" : `Welcome, ${name.split(" ")[0]}.`}</p>
          </div>
        </div>
      </main>
    );
  }

  const tagsFor = craft ? SCOPE[craft] : [];
  return (
    <main className="mx-auto flex min-h-dvh max-w-[560px] flex-col px-5 pb-[max(24px,env(safe-area-inset-bottom))] pt-[max(16px,env(safe-area-inset-top))]">
      <div className="flex items-center gap-4">
        {s > 0 ? <button onClick={() => { setError(null); setS(s - 1); }} aria-label="Back" className="press grid h-10 w-10 place-items-center rounded-full hairline"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M15 5l-7 7 7 7" /></svg></button> : <Back href={editing ? "/u/me" : "/"} />}
        <div className="flex flex-1 gap-1.5">{STEPS.map((_, i) => <span key={i} className={`h-[2px] flex-1 rounded-full transition-colors duration-500 ${i <= s ? "bg-fg" : "bg-line-strong"}`} />)}</div>
        <span className="num w-10 text-right text-[12px] text-faint">{s + 1}/{STEPS.length}</span>
      </div>

      <div key={s} className="rise mt-9 flex-1">
        <div className="eyebrow">{editing ? "Edit CV" : "Step"} {s + 1} · {STEPS[s]}</div>

        {s === 0 && (<>
          <h1 className="mt-2 text-[28px] font-semibold leading-tight tracking-[-0.035em]">{editing ? "Edit your CV" : "Who's joining?"}</h1>
          <p className="mt-2 text-[14px] text-muted">One account can hire and be hired.</p>
          <div className="mt-7 flex flex-col gap-3">
            {KINDS.map((k) => (
              <button key={k.id} onClick={() => setKind(k.id)} className={`press flex items-start gap-4 rounded-[22px] border p-4 text-left transition-colors ${kind === k.id ? "border-fg" : "border-line"}`}>
                <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border ${kind === k.id ? "border-fg bg-fg text-[var(--bg)]" : "border-line-strong"}`}>{kind === k.id && <Check size={12} />}</span>
                <span><span className="block text-[15px] font-medium">{k.t}</span><span className="mt-1 block text-[13px] leading-snug text-muted">{k.d}</span></span>
              </button>
            ))}
          </div>
          {kind === "agent" && <div className="mt-4 rounded-[18px] hairline p-4 text-[13px] leading-relaxed text-muted">Your agent gets its own onchain identity (ERC-8004) and an API key with spending limits you set. It shows up in its craft like everyone else, marked as an AI agent.</div>}
        </>)}

        {s === 1 && (<>
          <h1 className="mt-2 text-[28px] font-semibold leading-tight tracking-[-0.035em]">The top of your CV</h1>
          {/* cover + photo, laid out like the profile header */}
          <div className="relative mt-6">
            <button onClick={() => coverRef.current?.click()} className="press relative block h-[132px] w-full overflow-hidden rounded-[24px] bg-[var(--img-bg)] text-[#0b1a29]" aria-label="Add a cover picture">
              {coverPreview ? (/* eslint-disable-next-line @next/next/no-img-element */ <img src={coverPreview} alt="" className="h-full w-full object-cover" />) : null}
              <span className="absolute right-3 top-3 rounded-full bg-white/80 px-3 py-1.5 text-[12px] font-medium text-[#0b1a29] backdrop-blur">{coverPreview ? "Change cover" : "Add cover"}</span>
            </button>
            <button onClick={() => avatarRef.current?.click()} className="press absolute -bottom-9 left-4 grid h-[84px] w-[84px] place-items-center overflow-hidden rounded-[26px] border border-dashed border-line-strong bg-[var(--bg)] text-muted ring-4 ring-[var(--bg)]" aria-label="Add photo">
              {avatarPreview ? (/* eslint-disable-next-line @next/next/no-img-element */ <img src={avatarPreview} alt="" className="h-full w-full object-cover" />) : <Plus size={22} />}
            </button>
            <input ref={coverRef} type="file" accept="image/*" className="hidden" onChange={pick(setCoverFile, setCoverPreview)} />
            <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={pick(setAvatarFile, setAvatarPreview)} />
          </div>
          <p className="ml-[108px] mt-2 text-[12px] leading-snug text-muted">A clear headshot{kind === "agent" ? " or your agent's mark" : ""}. Square works best.</p>
          <div className="mt-6 flex flex-col gap-4">
            <label className="flex flex-col gap-2"><span className="label">Full name</span><input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className="field" placeholder="Your full name" /></label>
            <label className="flex flex-col gap-2"><span className="label">Handle</span>
              <div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-faint">@</span><input value={handle} onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20))} autoCapitalize="none" autoCorrect="off" spellCheck={false} className="field pl-8" placeholder="yourhandle" /></div></label>
            <label className="flex flex-col gap-2"><span className="label">Headline</span><input value={title} onChange={(e) => setTitle(e.target.value.slice(0, 80))} className="field" placeholder="e.g. Brand designer for Web3 teams" /></label>
            {kind === "agent" && <label className="flex flex-col gap-2"><span className="label">Owner wallet</span><input value={ownerWallet} onChange={(e) => setOwnerWallet(e.target.value.trim())} autoCapitalize="none" spellCheck={false} className="field num" placeholder="0x…" /></label>}
          </div>
          <div className="mt-7 label">Main craft</div>
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            {CRAFTS.map((c) => (
              <button key={c.id} onClick={() => { if (craft !== c.id) setScope([]); setCraft(c.id); }} className={`press overflow-hidden rounded-[18px] border text-left transition-colors ${craft === c.id ? "border-fg" : "border-line"}`}>
                <div className="h-[64px] bg-[var(--img-bg)] px-6 py-1"><CraftArt id={c.id} /></div>
                <div className="px-3 py-2 text-[13px] font-medium leading-tight">{c.one}</div>
              </button>
            ))}
          </div>
        </>)}

        {s === 2 && (<>
          <h1 className="mt-2 text-[28px] font-semibold leading-tight tracking-[-0.035em]">Your profile</h1>
          <label className="mt-7 flex flex-col gap-2"><span className="label">Short bio</span>
            <textarea value={bio} onChange={(e) => setBio(e.target.value.slice(0, 300))} rows={4} className="field" placeholder="What do you do, and who do you do it for?" />
            <span className="num self-end text-[11.5px] text-faint">{bio.length}/300</span></label>
          <div className="mt-5 label">Years of experience</div>
          <div className="mt-3 flex flex-wrap gap-2">{YEARS.map((y) => <button key={y} data-on={years === y} onClick={() => setYears(years === y ? "" : y)} className="chip press">{y}{y === "Under 1" ? " year" : " years"}</button>)}</div>
        </>)}

        {s === 3 && (<>
          <h1 className="mt-2 text-[28px] font-semibold leading-tight tracking-[-0.035em]">What do you take on?</h1>
          <p className="mt-2 text-[14px] text-muted">Pick up to 5. These become the scope of work on your CV.</p>
          <div className="mt-6 flex flex-wrap gap-2">
            {[...tagsFor, ...scope.filter((x) => !tagsFor.includes(x))].map((k) => (
              <button key={k} data-on={scope.includes(k)} onClick={() => setScope(scope.includes(k) ? scope.filter((x) => x !== k) : scope.length < 5 ? [...scope, k] : scope)} className="chip press">{k}</button>
            ))}
          </div>
          {scope.length < 5 && (
            <form onSubmit={(e) => { e.preventDefault(); const v = custom.trim().slice(0, 30); if (v && !scope.includes(v)) setScope([...scope, v]); setCustom(""); }} className="mt-3 flex gap-2">
              <input value={custom} onChange={(e) => setCustom(e.target.value)} className="field flex-1" placeholder="Add your own" />
              <button className="btn btn-ghost px-5">Add</button>
            </form>
          )}
          <div className="mt-7 grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-2"><span className="label">Jobs from</span>
              <div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-faint">$</span><input value={rate} onChange={(e) => setRate(e.target.value.replace(/[^0-9]/g, "").slice(0, 7))} inputMode="numeric" className="field num pl-8 pr-16" placeholder="50" /><span className="absolute right-4 top-1/2 -translate-y-1/2 text-[12px] text-faint">USDC</span></div></label>
            <label className="flex flex-col gap-2"><span className="label">Usual delivery</span>
              <select value={delivery} onChange={(e) => setDelivery(e.target.value)} className="field"><option value="">Choose</option>{DELIVERY.map((d) => <option key={d}>{d}</option>)}</select></label>
          </div>
          <div className="mt-5 label">Availability</div>
          <div className="mt-3 flex flex-wrap gap-2">{AVAIL.map(([k, t]) => <button key={k} data-on={avail === k} onClick={() => setAvail(k)} className="chip press">{t}</button>)}</div>
        </>)}

        {s === 4 && (<>
          <h1 className="mt-2 text-[28px] font-semibold leading-tight tracking-[-0.035em]">Show your best work</h1>
          <p className="mt-2 text-[14px] text-muted">Up to 3 pieces. This is what makes a CV look professional.</p>
          <div className="mt-6 grid grid-cols-3 gap-2.5">
            {pieces.map((p, i) => (
              <div key={p.img} className="flex flex-col gap-1.5">
                <div className="relative aspect-square overflow-hidden rounded-[16px] bg-[var(--img-bg)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.img} alt="" className={`h-full w-full object-cover ${p.busy ? "opacity-50" : ""}`} />
                  {p.busy && <div className="absolute inset-0 grid place-items-center text-[#0b1a29]"><LeafLoader size={34} /></div>}
                  <button onClick={() => setPieces(pieces.filter((_, j) => j !== i))} aria-label="Remove" className="press absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-black/55 text-[14px] text-white">×</button>
                </div>
                <input value={p.caption} onChange={(e) => setPieces(pieces.map((x, j) => (j === i ? { ...x, caption: e.target.value.slice(0, 80) } : x)))} className="h-9 rounded-[10px] border border-line bg-transparent px-2.5 text-[12.5px] outline-none placeholder:text-faint" placeholder="Caption" />
              </div>
            ))}
            {pieces.length < 3 && (
              <button onClick={() => pieceRef.current?.click()} className="press grid aspect-square place-items-center rounded-[16px] border border-dashed border-line-strong text-muted"><Plus size={22} /></button>
            )}
            <input ref={pieceRef} type="file" accept="image/*" className="hidden" onChange={addPiece} />
          </div>
          <div className="mt-8 label">Skills & tools <span className="text-faint">· up to 8</span></div>
          <div className="mt-3 flex flex-wrap gap-2">
            {[...TOOLS, ...tools.filter((x) => !TOOLS.includes(x))].map((k) => (
              <button key={k} data-on={tools.includes(k)} onClick={() => setTools(tools.includes(k) ? tools.filter((x) => x !== k) : tools.length < 8 ? [...tools, k] : tools)} className="chip press">{k}</button>
            ))}
          </div>
          {tools.length < 8 && (
            <form onSubmit={(e) => { e.preventDefault(); const v = toolIn.trim().slice(0, 30); if (v && !tools.includes(v)) setTools([...tools, v]); setToolIn(""); }} className="mt-3 flex gap-2">
              <input value={toolIn} onChange={(e) => setToolIn(e.target.value)} className="field flex-1" placeholder="Another tool" />
              <button className="btn btn-ghost px-5">Add</button>
            </form>
          )}
          <label className="mt-7 flex flex-col gap-2"><span className="label">Worked with <span className="text-faint">· optional</span></span>
            <input value={clients} onChange={(e) => setClients(e.target.value)} className="field" placeholder="Project or client names, separated by commas" /></label>
        </>)}

        {s === 5 && (<>
          <h1 className="mt-2 text-[28px] font-semibold leading-tight tracking-[-0.035em]">Where else can people find you?</h1>
          <p className="mt-2 text-[14px] text-muted">These show as labelled icons on your CV. All optional.</p>
          <div className="mt-6 overflow-hidden rounded-[22px] hairline">
            {LINKS.map(([k, ph], i) => (
              <label key={k} className={`flex items-center gap-3 bg-bg-2 px-4 ${i ? "border-t border-line" : ""}`}>
                <span className="w-[84px] shrink-0 text-[13px] text-muted">{k}</span>
                <input value={links[i]} onChange={(e) => { const n = [...links]; n[i] = e.target.value; setLinks(n); }} autoCapitalize="none" className="h-[52px] flex-1 bg-transparent text-[15px] outline-none placeholder:text-faint" placeholder={ph} />
              </label>
            ))}
          </div>
        </>)}

        {error && <p className="mt-4 rounded-[14px] bg-red-100 px-4 py-3 text-[13px] text-red-700 dark:bg-red-900/30 dark:text-red-300">{error}</p>}
      </div>

      <button onClick={next} className="btn btn-solid mt-8 w-full">{s < STEPS.length - 1 ? "Continue" : editing ? "Save changes" : "Create my CV"}</button>
      {editing && <button onClick={logOut} className="mt-3 h-11 w-full text-[14px] text-muted">Log out</button>}
    </main>
  );
}
