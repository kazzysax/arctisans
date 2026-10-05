import { z } from "zod";
import { keccak256, toBytes } from "viem";
import { db } from "@/db";
import { ok, fail, route } from "@/lib/api";
import { requireSession } from "@/lib/session";
import { listFeed } from "@/lib/queries";
import { processImages, storeImage, MAX_IMAGES } from "@/lib/images";
import { publishCalls } from "@/lib/tx";
import { isOurVideo } from "@/lib/video";
import { pollSoon } from "@/lib/xlink";

export const maxDuration = 60;

// Feeds: ?feed=work|request &skill= &city= &kind=human|agent &following=1 &before=
export const GET = route("posts", 120, async (req) => {
  pollSoon();
  const u = new URL(req.url);
  const feed = u.searchParams.get("feed") === "request" ? "request" : "work";
  const kind = u.searchParams.get("kind");
  let following: string | undefined;
  if (u.searchParams.get("following")) following = requireSession(req).wallet;
  const items = await listFeed({
    id: u.searchParams.get("id") ?? undefined, feed, skill: u.searchParams.get("skill") ?? undefined, city: u.searchParams.get("city") ?? undefined,
    kind: kind === "human" || kind === "agent" ? kind : undefined, following,
    author: u.searchParams.get("authorHandle") ?? undefined,
    before: Number(u.searchParams.get("before")) || undefined,
  });
  return ok({ items, next: items.length ? items[items.length - 1].createdAt : null });
});

const Meta = z.object({ body: z.string().max(1500).default(""), skill: z.string().max(30).optional(), city: z.string().max(60).optional(), budget: z.number().int().min(0).max(100_000_000).optional() });

/**
 * Work feed: multipart, 1-3 pictures REQUIRED (pictures only, compressed). Requests feed: text only.
 * Posting is for registered Arctisans. Returns a ready-to-sign onchain "publish" call (hash anchor) for work posts.
 */
export const POST = route("post-create", 20, async (req) => {
  const { wallet } = requireSession(req);
  const me = await db().execute({ sql: "SELECT wallet FROM users WHERE wallet=?", args: [wallet] });
  if (!me.rows.length) return fail(403, "Create your profile first");
  const form = await req.formData();
  const feed = form.get("feed") === "request" ? "request" : "work";
  const meta = Meta.parse({
    body: String(form.get("body") ?? ""), skill: form.get("skill") ? String(form.get("skill")) : undefined,
    city: form.get("city") ? String(form.get("city")) : undefined, budget: form.get("budget") ? Number(form.get("budget")) : undefined,
  });
  const files = form.getAll("images").filter((f): f is File => f instanceof File);
  const video = form.get("video") ? String(form.get("video")) : null;
  let refs: string[] = [], hashes: string[] = [];
  if (feed === "work") {
    if (video) {
      if (!isOurVideo(video)) return fail(400, "Invalid video");
      if (files.length) return fail(400, "Post either a video or pictures");
      hashes = [video];
    } else {
      if (files.length > MAX_IMAGES) return fail(400, `Max ${MAX_IMAGES} pictures per post`);
      const processed = await processImages(await Promise.all(files.map(async (f) => Buffer.from(await f.arrayBuffer()))));
      refs = await Promise.all(processed.map(storeImage)); hashes = processed.map((p) => p.sha256);
    }
  } else {
    if (files.length || video) return fail(400, "Requests are text only");
    if (meta.body.trim().length < 5) return fail(400, "Describe what you need");
  }
  const id = crypto.randomUUID();
  const postHash = keccak256(toBytes(JSON.stringify({ id, wallet, body: meta.body, hashes })));
  await db().execute({
    sql: "INSERT INTO posts(id,author_wallet,feed,body,images,video,skill,city,hash,budget,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
    args: [id, wallet, feed, meta.body, JSON.stringify(refs), video, meta.skill?.toLowerCase() ?? null, meta.city ?? null, postHash, meta.budget ?? null, Date.now()],
  });
  return ok({ id, hash: postHash, anchor: feed === "work" ? publishCalls(postHash, refs[0] ?? video ?? "") : [] }, 201);
});
