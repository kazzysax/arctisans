import { z } from "zod";
import { getAddress, keccak256, toBytes } from "viem";
import { db } from "@/db";
import { ok, fail, route } from "@/lib/api";
import { requireSession } from "@/lib/session";
import { tipCalls } from "@/lib/tx";
import { MIN_TIP, TIP_PRESETS } from "@/lib/money";

const B = z.object({ to: z.string().regex(/^0x[a-fA-F0-9]{40}$/), amount: z.number().int().min(MIN_TIP).max(100_000_000), postId: z.string().uuid().optional() });

/** Builds the 2-step (approve + tip) batch for the user to confirm once. Money goes wallet -> artisan directly. */
export const POST = route("tip", 30, async (req) => {
  const { wallet } = requireSession(req);
  const b = B.parse(await req.json());
  if (b.to.toLowerCase() === wallet) return fail(400, "You cannot tip yourself");
  const dest = await db().execute({ sql: "SELECT wallet FROM users WHERE wallet=?", args: [b.to.toLowerCase()] });
  if (!dest.rows.length) return fail(404, "That person has no profile");
  let postHash = keccak256(toBytes("profile"));
  if (b.postId) {
    const p = await db().execute({ sql: "SELECT hash, author_wallet FROM posts WHERE id=?", args: [b.postId] });
    if (!p.rows.length || String(p.rows[0].author_wallet) !== b.to.toLowerCase()) return fail(400, "Post does not belong to that person");
    postHash = String(p.rows[0].hash) as `0x${string}`;
  }
  return ok({ calls: tipCalls(getAddress(b.to), b.amount, postHash), presets: TIP_PRESETS });
});

export const GET = route("tip-info", 120, async (req) => {
  const to = new URL(req.url).searchParams.get("to")?.toLowerCase();
  if (!to) return fail(400, "to required");
  const r = await db().execute({ sql: "SELECT COUNT(*) n, COALESCE(SUM(amount),0) s FROM tips WHERE to_wallet=?", args: [to] });
  return ok({ count: Number(r.rows[0].n), total: Number(r.rows[0].s), presets: TIP_PRESETS, min: MIN_TIP });
});
