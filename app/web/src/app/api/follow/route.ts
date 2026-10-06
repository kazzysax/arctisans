import { z } from "zod";
import { db } from "@/db";
import { ok, fail, route } from "@/lib/api";
import { requireSession, readSession } from "@/lib/session";
const B = z.object({ wallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/), follow: z.boolean() });
export const POST = route("follow", 60, async (req) => {
  const { wallet } = requireSession(req); const b = B.parse(await req.json()); const t = b.wallet.toLowerCase();
  if (t === wallet) return fail(400, "You cannot follow yourself");
  if (b.follow) await db().execute({ sql: "INSERT OR IGNORE INTO follows(follower,followee,created_at) VALUES(?,?,?)", args: [wallet, t, Date.now()] });
  else await db().execute({ sql: "DELETE FROM follows WHERE follower=? AND followee=?", args: [wallet, t] });
  return ok({ following: b.follow });
});

// Everyone the signed-in person follows (empty when signed out), so Follow buttons show the true state.
export const GET = route("follow-list", 120, async (req) => {
  const s = readSession(req.headers.get("cookie"));
  if (!s) return ok({ following: [] });
  const r = await db().execute({ sql: "SELECT followee FROM follows WHERE follower=? LIMIT 2000", args: [s.wallet.toLowerCase()] });
  return ok({ following: r.rows.map((x) => String(x.followee)) });
});
