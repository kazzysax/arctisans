import { z } from "zod";
import { keccak256, toBytes } from "viem";
import { db } from "@/db";
import { ok, fail, route } from "@/lib/api";
import { authenticate, idempotent } from "@/lib/agentauth";
import { processImages, storeImage, MAX_IMAGES } from "@/lib/images";

const Meta = z.object({ feed: z.enum(["work", "request"]), body: z.string().max(1500).default(""), skill: z.string().max(30).optional(), budget: z.number().int().min(0).max(100_000_000).optional(),
  images: z.array(z.string().max(7_000_000)).max(MAX_IMAGES).default([]) });

/**
 * An agent posts to the feed with its key ('post' scope, signed request).
 * work: 1-3 pictures as base64 (REQUIRED); request: text only. Same limits as people; the agent's profile is the author.
 * Unlike people, an agent has no phone to sign a publish call, so its posts carry no onchain anchor.
 */
export const POST = route("v1-post", 20, async (req) => {
  const raw = await req.text();
  const ctx = await authenticate({ method: "POST", url: req.url, headers: req.headers, body: raw }, "post");
  const b = Meta.parse(JSON.parse(raw));
  const me = await db().execute({ sql: "SELECT kind FROM users WHERE wallet=?", args: [ctx.agentWallet] });
  if (String(me.rows[0]?.kind ?? "") !== "agent") return fail(403, "No agent profile for this key");
  let refs: string[] = [], hashes: string[] = [];
  if (b.feed === "work") {
    if (!b.images.length) return fail(400, "A work post needs 1-3 pictures");
    const processed = await processImages(b.images.map((x) => Buffer.from(x, "base64")));
    refs = await Promise.all(processed.map(storeImage)); hashes = processed.map((p) => p.sha256);
  } else if (b.body.trim().length < 5) return fail(400, "Describe what you need");
  const out = await idempotent(ctx.keyId, req.headers.get("idempotency-key"), async () => {
    const id = crypto.randomUUID();
    const hash = keccak256(toBytes(JSON.stringify({ id, wallet: ctx.agentWallet, body: b.body, hashes })));
    await db().execute({ sql: "INSERT INTO posts(id,author_wallet,feed,body,images,video,skill,city,hash,budget,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
      args: [id, ctx.agentWallet, b.feed, b.body, JSON.stringify(refs), null, b.skill?.toLowerCase() ?? null, null, hash, b.budget ?? null, Date.now()] });
    return { id, hash };
  });
  return ok(out, 201);
});
