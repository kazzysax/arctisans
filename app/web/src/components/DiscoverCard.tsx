"use client";
import { useState, ViewTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { people, type Post, type Person } from "@/lib/demo";
import { Verified } from "./Verified";
import { AgentTag } from "./AgentTag";
import { PostVideo } from "./PostVideo";
import { FollowButton } from "./fun/FollowButton";
import { LikeBurst, useTaps } from "./fun/LikeBurst";

// Tall portrait card: glass creator chip on top, hairline frame, caption over a soft scrim. Up to 3 photos.
// Tap: open the post (the photo morphs into it). Double-tap: appreciate. Edge taps: page through pictures.
export function DiscoverCard({ post }: { post: Post }) {
  const p: Person = post.author ?? people[post.by] ?? { handle: post.by, name: post.by, title: "Arctisan", city: "", avatar: "/demo/bg_blue_soft.jpg", kind: "human", jobs: 0, rating: null };
  const r = useRouter();
  const [i, setI] = useState(0);
  const [burst, setBurst] = useState(0);
  const [likes, setLikes] = useState(post.likes);
  const n = post.video ? 1 : post.photos.length;
  const tap = useTaps(() => r.push(`/p/${post.id}?i=${i}`), () => { setBurst((b) => b + 1); setLikes((l) => (l === post.likes ? l + 1 : l)); });
  return (
    <article className="relative h-[460px] w-[300px] shrink-0 snap-start overflow-hidden rounded-[30px] hairline-strong bg-bg-2">
      {post.video ? (
          <PostVideo src={post.video} className="absolute inset-0 h-full w-full bg-[var(--img-bg)] object-cover" />
        ) : post.photos.length === 0 ? (
          <div className="absolute inset-0 bg-[var(--img-bg)]" />
        ) : (
        <ViewTransition name={`photo-${post.id}`} share="morph" default="none">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={post.photos[i]} alt={post.caption} className="absolute inset-0 h-full w-full bg-[var(--img-bg)] object-cover" />
        </ViewTransition>
        )}
      <button aria-label="Open post" className="absolute inset-0 z-10" onClick={tap} />
      {n > 1 && (
        <>
          <button aria-label="Previous picture" className="absolute inset-y-24 left-0 z-10 w-1/4" onClick={() => setI((i - 1 + n) % n)} />
          <button aria-label="Next picture" className="absolute inset-y-24 right-0 z-10 w-1/4" onClick={() => setI((i + 1) % n)} />
          <div className="absolute bottom-[118px] right-5 z-30 flex gap-1">
            {post.photos.map((_, k) => <span key={k} className={`h-[3px] rounded-full transition-all duration-300 ${k === i ? "w-4 bg-white" : "w-[3px] bg-white/45"}`} />)}
          </div>
        </>
      )}
      <div className="scrim-b pointer-events-none absolute inset-0" />
      <LikeBurst k={burst} />

      {/* creator chip */}
      <div className="absolute inset-x-3 top-3 z-20 flex items-center gap-2.5 rounded-[20px] border border-white/15 bg-black/35 p-2 pr-2 backdrop-blur-xl">
        <Link href={post.demo ? "#" : `/u/${p.handle}`} onClick={(e) => post.demo && e.preventDefault()} className="flex min-w-0 flex-1 items-center gap-2.5">
          <ViewTransition name={`avatar-${p.handle}-${post.id}`} share="morph" default="none">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.avatar} alt="" className="h-9 w-9 rounded-[12px] object-cover" />
          </ViewTransition>
          <div className="min-w-0 leading-tight text-white">
            <div className="flex items-center gap-1 text-[13px] font-medium"><span className="truncate">{p.name}</span>{p.verified && <Verified size={13} onPhoto />}{p.kind === "agent" && <AgentTag onPhoto />}</div>
            <div className="truncate text-[11px] text-white/60">{p.title}{post.demo ? " · sample" : p.jobs ? ` · ${p.jobs} jobs` : ""}</div>
          </div>
        </Link>
        {!post.demo && <FollowButton onPhoto size="sm" />}
      </div>

      {/* caption */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 p-5 text-white">
        <div className="mb-1.5 flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-white/55">
          <span>{post.skill}</span><span className="h-[3px] w-[3px] rounded-full bg-white/40" /><span>{post.ago}</span>
        </div>
        <p className="text-[15px] font-medium leading-snug tracking-[-0.01em]">{post.caption}</p>
        <div className="mt-2.5 text-[11px] text-white/55">{likes} appreciations · {post.tips} tips</div>
      </div>
    </article>
  );
}
