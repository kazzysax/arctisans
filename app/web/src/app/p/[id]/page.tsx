"use client";
import { use, useState, useEffect, ViewTransition } from "react";
import Link from "next/link";
import { notFound, useSearchParams } from "next/navigation";
import { people, postById, profileOf, type Post, type Person } from "@/lib/demo";
import { Back } from "@/components/ui";
import { Verified } from "@/components/Verified";
import { FollowButton } from "@/components/fun/FollowButton";
import { LikeBurst, useTaps } from "@/components/fun/LikeBurst";
import { TipSheet } from "@/components/TipSheet";
import { Heart, Coin } from "@/components/icons";
import { Roll } from "@/components/fun/Roll";

// Work post: the photo from the feed morphs into this hero. Swipe through up to 3 pictures.
export default function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const sample = postById(id);
  const [real, setReal] = useState<Post | null | undefined>(sample ? null : undefined);
  useEffect(() => {
    if (sample) return;
    fetch(`/api/posts?id=${encodeURIComponent(id)}`).then((r) => r.json()).then((j: { items?: { id: string; handle: string; displayName: string; title: string | null; avatar: string | null; kind: string; verified: boolean; authorWallet: string; images: string[]; video: string | null; body: string; skill: string | null; likes: number; createdAt: number }[] }) => {
      const x = j.items?.[0];
      if (!x) { setReal(null); return; }
      const author: Person = { handle: x.handle, name: x.displayName, title: x.title ?? "Arctisan", city: "", avatar: x.avatar ?? "/demo/bg_blue_soft.jpg", kind: x.kind === "agent" ? "agent" : "human", jobs: 0, rating: null, verified: x.verified };
      const h = Math.floor((Date.now() - x.createdAt) / 3600000);
      setReal({ id: x.id, by: x.handle, author, to: x.authorWallet, photos: x.images, video: x.video, caption: x.body, skill: x.skill ?? "", likes: x.likes, tips: 0, ago: h < 1 ? "now" : h < 24 ? `${h}h` : `${Math.floor(h / 24)}d` });
    }).catch(() => setReal(null));
  }, [id, sample]);
  const post = sample ?? real ?? undefined;
  const sp = useSearchParams();
  const [i, setI] = useState(Number(sp.get("i") ?? 0));
  const [likes, setLikes] = useState(post?.likes ?? 0);
  const [liked, setLiked] = useState(false);
  const [burst, setBurst] = useState(0);
  const [tip, setTip] = useState(false);
  const like = () => { if (!liked) { setLiked(true); setLikes((l) => l + 1); } setBurst((b) => b + 1); };
  const tap = useTaps(() => setI((x) => (x + 1) % (post?.photos.length ?? 1)), like);
  if (!sample && real === undefined) return <div className="mx-auto min-h-dvh max-w-[560px]"><div className="aspect-[4/5] w-full animate-pulse bg-[var(--img-bg)]" /></div>;
  if (!post) notFound();
  const p: Person = post.author ?? people[post.by], f = profileOf(post.by);
  const demo = !!post.demo;
  return (
    <div className="relative mx-auto min-h-dvh max-w-[560px] pb-32">
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-[var(--img-bg)] lg:mt-6 lg:rounded-[30px]">
{post.video ? (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video src={post.video} controls loop playsInline autoPlay muted preload="metadata" className="absolute inset-0 h-full w-full bg-black object-contain" />
        ) : (<>
        <ViewTransition name={`photo-${post.id}`} share="morph" default="none">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <div className="absolute inset-0">
            {/* Whole picture, never cropped: fitted inside the frame over a soft blurred copy of itself */}
            <img src={post.photos[i]} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-2xl" />
            <img src={post.photos[i]} alt={post.caption} className="absolute inset-0 h-full w-full object-contain" />
          </div>
        </ViewTransition>
        <button aria-label="Next picture, double tap to appreciate" onClick={tap} className="absolute inset-0" />
        </>)}
        <LikeBurst k={burst} />
        <div className="absolute inset-x-4 top-[max(16px,env(safe-area-inset-top))] flex items-center justify-between">
          <Back />
          {post.photos.length > 1 && <span className="glass rounded-full px-3 py-1.5 text-[12px] text-fg">{i + 1} / {post.photos.length}</span>}
        </div>
        {post.photos.length > 1 && (
          <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-1.5">
            {post.photos.map((_, k) => <button key={k} aria-label={`Picture ${k + 1}`} onClick={() => setI(k)} className={`h-[3px] rounded-full transition-all duration-300 ${k === i ? "w-5 bg-white" : "w-[3px] bg-white/50"}`} />)}
          </div>
        )}
      </div>

      <div className="px-5 pt-5">
        <div className="flex items-center gap-3">
          <Link href={demo ? "#" : `/u/${p.handle}`} onClick={(e) => demo && e.preventDefault()} className="flex min-w-0 flex-1 items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.avatar} alt="" className="h-11 w-11 rounded-[14px] object-cover" />
            <div className="min-w-0 leading-tight">
              <div className="flex items-center gap-1 text-[15px] font-medium">{p.name}{p.verified && <Verified size={13} />}</div>
              <div className="text-[12.5px] text-muted">{p.title}{demo ? " · sample post" : p.jobs ? ` · ${p.jobs} paid jobs · ${f.onTime}% on time` : ""}</div>
            </div>
          </Link>
          {!demo && <FollowButton size="sm" />}
        </div>
        <div className="mt-5 flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-faint"><span>{post.skill}</span><span className="h-[3px] w-[3px] rounded-full bg-faint" /><span>{post.ago}</span></div>
        <p className="mt-2 text-[18px] font-medium leading-snug tracking-[-0.02em]">{post.caption}</p>
        <div className="mt-5 flex items-center gap-5 border-y border-line py-3.5 text-[13px] text-muted">
          <button onClick={like} aria-pressed={liked} className="press flex items-center gap-2"><Heart size={20} className={liked ? "fill-current text-fg" : ""} /><Roll value={likes} /></button>
          {!demo && <button onClick={() => setTip(true)} className="press flex items-center gap-2"><Coin size={20} /><span>{post.tips} tips</span></button>}
        </div>
        {demo ? <p className="mt-4 text-[13px] leading-relaxed text-faint">This is a sample post showing what work looks like on Arctisans. Post yours from Create.</p> : <p className="mt-4 text-[13px] leading-relaxed text-faint">Like what you see? Hire {p.name.split(" ")[0]} with an agreement. You fund the escrow, and money is released by the rules you both agree.</p>}
      </div>

      {!demo && <div className="fixed bottom-0 left-[var(--rail)] right-[var(--aside)] z-40 flex justify-center bg-gradient-to-t from-[var(--bg)] via-[var(--bg)] to-transparent px-5 pb-[max(18px,env(safe-area-inset-bottom))] pt-8 lg:pb-8">
        <div className="flex w-full max-w-[520px] gap-2">
          <button onClick={() => setTip(true)} className="btn btn-ghost">Tip</button>
          <Link href={`/hire/${p.handle}`} className="btn btn-solid flex-1">Hire {p.name.split(" ")[0]}</Link>
        </div>
      </div>}
      <TipSheet open={tip} onClose={() => setTip(false)} name={p.name} avatar={p.avatar} to={post.to} postId={demo ? undefined : post.id} />
    </div>
  );
}
