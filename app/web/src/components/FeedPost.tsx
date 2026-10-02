"use client";
import { useState } from "react";
import Link from "next/link";
import { people, type Post } from "@/lib/demo";
import { Heart, Coin, Dots } from "./icons";
import { Verified } from "./Verified";

// "From people you follow": header row, square photo with page dots, action row with Tip and Hire.
export function FeedPost({ post }: { post: Post }) {
  const p = people[post.by];
  const [i, setI] = useState(0);
  const [liked, setLiked] = useState(false);
  const n = post.photos.length;
  return (
    <article className="overflow-hidden rounded-[28px] hairline bg-bg-2">
      <header className="flex items-center gap-3 p-3.5">
        <Link href={`/u/${p.handle}`} className="flex min-w-0 flex-1 items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.avatar} alt="" className="h-10 w-10 rounded-[13px] object-cover" />
          <div className="min-w-0 leading-tight">
            <div className="flex items-center gap-1 text-[14px] font-medium"><span className="truncate">{p.name}</span>{p.verified && <Verified size={13} />}</div>
            <div className="truncate text-[12px] text-muted">{p.title} · {p.city}</div>
          </div>
        </Link>
        <span className="text-[12px] text-faint">{post.ago}</span>
        <button aria-label="More" className="press -mr-1 grid h-8 w-8 place-items-center text-muted"><Dots size={18} /></button>
      </header>

      <div className="relative mx-3.5 aspect-[4/5] overflow-hidden rounded-[20px] bg-bg">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={post.photos[i]} alt={post.caption} className="absolute inset-0 h-full w-full object-cover" />
        {n > 1 && (
          <>
            <button aria-label="Previous picture" className="absolute inset-y-0 left-0 w-1/3" onClick={() => setI((i - 1 + n) % n)} />
            <button aria-label="Next picture" className="absolute inset-y-0 right-0 w-1/3" onClick={() => setI((i + 1) % n)} />
            <span className="absolute right-3 top-3 rounded-full bg-black/45 px-2.5 py-1 text-[11px] text-white backdrop-blur-md">{i + 1}/{n}</span>
          </>
        )}
      </div>

      <div className="flex items-center gap-1 px-3.5 pt-3">
        <button onClick={() => setLiked(!liked)} aria-pressed={liked} className="press flex h-9 items-center gap-1.5 rounded-full px-2 text-[13px] text-muted">
          <Heart size={20} className={liked ? "fill-current text-fg" : ""} /> {post.likes + (liked ? 1 : 0)}
        </button>
        <button className="press flex h-9 items-center gap-1.5 rounded-full px-2 text-[13px] text-muted"><Coin size={20} /> Tip</button>
        <div className="flex-1" />
        <Link href={`/u/${p.handle}?hire=1`} className="press flex h-9 items-center rounded-full bg-pill px-4 text-[13px] font-medium text-pill-fg">Hire</Link>
      </div>
      <p className="px-5 pb-5 pt-2 text-[14px] leading-relaxed text-fg/85">
        <span className="font-medium text-fg">{p.name.split(" ")[0]}</span> {post.caption}
      </p>
    </article>
  );
}
