import Link from "next/link";
import { people } from "@/lib/demo";
import { FollowButton } from "../fun/FollowButton";
import { Roll } from "../fun/Roll";
import { Verified } from "../Verified";
import { REQUESTS } from "@/lib/requests";

// Laptop right panel: your record, open requests that fit you, and people to follow.
export function Aside() {
  const suggest = ["lena", "tobi", "atlas"].map((h) => people[h]);
  return (
    <aside className="no-scrollbar fixed inset-y-0 right-0 z-30 hidden w-[340px] flex-col gap-5 overflow-y-auto border-l border-line px-6 pb-8 pt-7 xl:flex">
      <section className="rounded-[24px] hairline p-5">
        <div className="eyebrow">Your record · on Arc</div>
        <div className="mt-4 grid grid-cols-3 gap-3">
          <div><div className="text-[22px] font-medium"><Roll value={38} /></div><div className="label mt-1">Jobs</div></div>
          <div><div className="text-[22px] font-medium"><Roll value={97} />%</div><div className="label mt-1">On time</div></div>
          <div><div className="text-[22px] font-medium"><Roll value={186} prefix="$" /></div><div className="label mt-1">Tips</div></div>
        </div>
        <Link href="/u/me" className="mt-4 block text-[12.5px] text-muted hover:text-fg">View reputation card →</Link>
      </section>

      <section>
        <div className="flex items-baseline justify-between"><h3 className="text-[15px] font-medium">Requests for you</h3><Link href="/search" className="text-[12px] text-muted">See all</Link></div>
        <div className="mt-2">
          {REQUESTS.slice(0, 3).map((r, i) => (
            <Link key={r.id} href={`/requests/${r.id}`} className={`press block py-3 ${i ? "border-t border-line" : ""}`}>
              <div className="text-[14px] leading-snug">{r.title}</div>
              <div className="mt-1 flex gap-2 text-[12px] text-faint"><span className="num text-fg">${r.budget}</span>· {r.due} · {r.applicants.length} applied</div>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-[15px] font-medium">People to follow</h3>
        <div className="mt-2">
          {suggest.map((p, i) => (
            <div key={p.handle} className={`flex items-center gap-3 py-3 ${i ? "border-t border-line" : ""}`}>
              <Link href={`/u/${p.handle}`} className="flex min-w-0 flex-1 items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.avatar} alt="" className="h-10 w-10 rounded-[13px] object-cover" />
                <div className="min-w-0 leading-tight"><div className="flex items-center gap-1 text-[14px] font-medium">{p.name}{p.verified && <Verified size={12} />}</div><div className="truncate text-[12px] text-muted">{p.title}</div></div>
              </Link>
              <FollowButton size="sm" />
            </div>
          ))}
        </div>
      </section>
      <p className="px-1 text-[11px] leading-relaxed text-faint">Arctisans · USDC on Arc · No platform fee</p>
    </aside>
  );
}
