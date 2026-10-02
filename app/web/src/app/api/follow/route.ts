import { z } from "zod";
import { db } from "@/db";
import { ok, fail, route } from "@/lib/api";
import { requireSession } from "@/lib/session";
const B = z.object({ wallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/), follow: z.boolean() });
export const POST = route("follow", 60, async (req) => {
  const { wallet } = requireSession(req); const b = B.parse(await req.json()); const t = b.wallet.toLowerCase();
  if (t === wallet) return fail(400, "You cannot follow yourself");
  if (b.follow) await db().execute({ sql: "INSERT OR IGNORE INTO follows(follower,followee,created_at) VALUES(?,?,?)", args: [wallet, t, Date.now()] });
  else await db().execute({ sql: "DELETE FROM follows WHERE follower=? AND followee=?", args: [wallet, t] });
  return ok({ following: b.follow });
});
