"use client";
import { use, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { people } from "@/lib/demo";
import { requestById } from "@/lib/requests";
import { TopBar, Sheet } from "@/components/ui";
import { Verified } from "@/components/Verified";
import { Empty } from "@/components/fun/Empty";
import { Check } from "@/components/icons";

// A request ("I need…"): the brief, then applicants. Arctisans apply with a price and time;
// the requester picks one and lands in a prefilled agreement.
export default function RequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const r = requestById(id);
  const [apply, setApply] = useState(false);
  const [sent, setSent] = useState(false);
  const [price, setPrice] = useState(r?.budget ?? 0);
  const [mine, setMine] = useState(false); // demo toggle: view as the requester
  if (!r) notFound();
  const by = people[r.by];
  return (
    <main className="mx-auto min-h-dvh max-w-[560px] pb-36">
      <TopBar back="/search" title="Request" right={<button onClick={() => setMine(!mine)} className="text-[12px] text-faint">{mine ? "View as Arctisan" : "View as requester"}</button>} />
      <div className="px-5">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={by.avatar} alt="" className="h-10 w-10 rounded-[13px] object-cover" />
          <div className="leading-tight"><div className="text-[14px] font-medium">{by.name}</div><div className="text-[12px] text-faint">{r.ago} ago · {by.city}</div></div>
        </div>
        <div className="eyebrow mt-6">{r.skill}</div>
        <h1 className="mt-2 text-[26px] font-semibold leading-[1.12] tracking-[-0.035em]">{r.title}</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-fg/80">{r.body}</p>

        <div className="mt-6 grid grid-cols-3 rounded-[22px] hairline">
          {[["Budget", `$${r.budget}`], ["Due", r.due], ["Open to", r.who.join(" + ")]].map(([k, v], i) => (
            <div key={k} className={`p-4 ${i ? "border-l border-line" : ""}`}><div className="label">{k}</div><div className="mt-1.5 text-[15px] font-medium capitalize">{v}</div></div>
          ))}
        </div>

        <div className="mt-9 flex items-baseline justify-between"><h2 className="text-[15px] font-medium">Applied</h2><span className="text-[12px] text-faint">{r.applicants.length + (sent ? 1 : 0)}</span></div>
        {r.applicants.length === 0 && !sent ? (
          <Empty art="plane" title="No one has applied yet" body="Be the first. Requests with an early, clear offer usually get picked." />
        ) : (
          <div className="mt-3 flex flex-col gap-3">
            {sent && <Applicant handle="amara" price={price} days={6} note="I can start tomorrow. Two concepts in 3 days." ago="now" pick={false} you />}
            {r.applicants.map((a) => <Applicant key={a.by} handle={a.by} price={a.price} days={a.days} note={a.note} ago={a.ago} pick={mine} hrefBase={r.id} />)}
          </div>
        )}
      </div>

      {!mine && (
        <div className="fixed bottom-0 left-[var(--rail)] right-[var(--aside)] z-40 flex justify-center bg-gradient-to-t from-[var(--bg)] via-[var(--bg)] to-transparent px-5 pb-[max(18px,env(safe-area-inset-bottom))] pt-8 lg:pb-8">
          <button disabled={sent} onClick={() => setApply(true)} className="btn btn-solid w-full max-w-[520px] disabled:opacity-60">{sent ? <><Check size={16} /> Applied</> : `Apply · $${r.budget}`}</button>
        </div>
      )}

      <Sheet open={apply} onClose={() => setApply(false)} title="Apply">
        <div className="label">Your price</div>
        <div className="relative mt-2"><span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[20px] text-faint">$</span><input inputMode="decimal" value={price} onChange={(e) => setPrice(Number(e.target.value) || 0)} className="field num !pl-9 !text-[20px]" /></div>
        <div className="label mt-4">Why you</div>
        <textarea rows={3} className="field mt-2" placeholder="Similar work you've done, and how you'd approach it." />
        <p className="mt-2 text-[12px] text-faint">If they pick you, you both review an agreement before any money moves.</p>
        <button onClick={() => { setApply(false); setSent(true); }} className="btn btn-solid mt-5 w-full">Send application</button>
      </Sheet>
    </main>
  );
}

function Applicant({ handle, price, days, note, ago, pick, you, hrefBase }: { handle: string; price: number; days: number; note: string; ago: string; pick: boolean; you?: boolean; hrefBase?: string }) {
  const p = people[handle];
  return (
    <div className={`rise rounded-[22px] p-4 ${you ? "hairline-strong" : "hairline"}`}>
      <div className="flex items-center gap-3">
        <Link href={`/u/${handle}`} className="flex min-w-0 flex-1 items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.avatar} alt="" className="h-10 w-10 rounded-[13px] object-cover" />
          <div className="min-w-0 leading-tight"><div className="flex items-center gap-1 text-[14px] font-medium">{you ? "You" : p.name}{p.verified && <Verified size={12} />}</div><div className="text-[12px] text-faint">{p.jobs} paid jobs · {ago}</div></div>
        </Link>
        <div className="text-right"><div className="num text-[17px] font-medium">${price}</div><div className="text-[11.5px] text-faint">{days} days</div></div>
      </div>
      <p className="mt-3 text-[13.5px] leading-relaxed text-fg/80">{note}</p>
      {pick && <Link href={`/hire/${handle}?from=${hrefBase}&price=${price}&days=${days}`} className="btn btn-solid btn-sm mt-3 w-full">Pick {p.name.split(" ")[0]} · draft agreement</Link>}
    </div>
  );
}
