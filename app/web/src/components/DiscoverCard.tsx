"use client";
import { useState } from "react";
import Link from "next/link";
import { people, type Post } from "@/lib/demo";
import { Verified } from "./Verified";

// Tall portrait card: glass creator chip on top, hairline frame, caption over a soft scrim. Up to 3 photos, tap edges to page.
export function DiscoverCard({ post }: { post: Post }) {
  const p = people[post.by];
  const [i, setI] = useState(0);
  const [following, setFollowing] = useState(false);
  const n = post.photos.length;
  return (
    <article className="relative h-[460px] w-[300px] shrink-0 snap-start overflow-hidden rounded-[30px] hairline-strong bg-bg-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={post.photos[i]} alt={post.caption} className="absolute inset-0 h-full w-full object-cover" />
      {n > 1 && (
        <>
          <button aria-label="Previous picture" className="absolute inset-y-0 left-0 z-10 w-1/3" onClick={() => setI((i - 1 + n) % n)} />
          <button aria-label="Next picture" className="absolute inset-y-0 right-0 z-10 w-1/3" onClick={() => setI((i + 1) % n)} />
          <div className="absolute right-5 bottom-[118px] z-30 flex gap-1">
            {post.photos.map((_, k) => <span key={k} className={`h-[3px] rounded-full transition-all duration-300 ${k === i ? "w-4 bg-white" : "w-[3px] bg-white/45"}`} />)}
          </div>
        </>
      )}
      <div className="scrim-b absolute inset-0" />

      {/* creator chip */}
      <div className="absolute inset-x-3 top-3 z-20 flex items-center gap-2.5 rounded-[20px] border border-white/15 bg-black/35 p-2 pr-2 backdrop-blur-xl">
        <Link href={`/u/${p.handle}`} className="flex min-w-0 flex-1 items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.avatar} alt="" className="h-9 w-9 rounded-[12px] object-cover" />
          <div className="min-w-0 leading-tight text-white">
            <div className="flex items-center gap-1 text-[13px] font-medium"><span className="truncate">{p.name}</span>{p.verified && <Verified size={13} onPhoto />}</div>
            <div className="truncate text-[11px] text-white/60">{p.title} · {p.jobs} jobs</div>
          </div>
        </Link>
        <button onClick={() => setFollowing(!following)} className={`press h-8 shrink-0 rounded-full px-3.5 text-[12px] font-medium transition-colors ${following ? "border border-white/30 text-white" : "bg-white text-black"}`}>
          {following ? "Following" : "Follow"}
        </button>
      </div>

      {/* caption */}
      <div className="absolute inset-x-0 bottom-0 z-20 p-5 text-white">
        <div className="mb-1.5 flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-white/55">
          <span>{post.skill}</span><span className="h-[3px] w-[3px] rounded-full bg-white/40" /><span>{post.ago}</span>
        </div>
        <p className="text-[15px] font-medium leading-snug tracking-[-0.01em]">{post.caption}</p>
        <div className="mt-2.5 text-[11px] text-white/55">{post.likes} appreciations · {post.tips} tips</div>
      </div>
    </article>
  );
}
