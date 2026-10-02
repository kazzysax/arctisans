import { z } from "zod";
import { db } from "@/db";
import { ok, route } from "@/lib/api";
import { requireSession } from "@/lib/session";
const B = z.object({ postId: z.string().uuid(), like: z.boolean() });
export const POST = route("like", 120, async (req) => {
  const { wallet } = requireSession(req); const b = B.parse(await req.json());
  if (b.like) await db().execute({ sql: "INSERT OR IGNORE INTO likes(post_id,wallet,created_at) VALUES(?,?,?)", args: [b.postId, wallet, Date.now()] });
  else await db().execute({ sql: "DELETE FROM likes WHERE post_id=? AND wallet=?", args: [b.postId, wallet] });
  const c = await db().execute({ sql: "SELECT COUNT(*) n FROM likes WHERE post_id=?", args: [b.postId] });
  return ok({ liked: b.like, likes: Number(c.rows[0].n) });
});
