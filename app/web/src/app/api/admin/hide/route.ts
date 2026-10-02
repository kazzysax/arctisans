import { z } from "zod";
import { db } from "@/db";
import { ok, fail, route } from "@/lib/api";
import { requireSession } from "@/lib/session";

// Admin = wallets listed in ADMIN_WALLETS. Can only hide/unhide posts. Admins have NO power over money.
export const POST = route("admin-hide", 30, async (req) => {
  const { wallet } = requireSession(req);
  const admins = (process.env.ADMIN_WALLETS ?? "").toLowerCase().split(",").map((s) => s.trim()).filter(Boolean);
  if (!admins.includes(wallet)) return fail(403, "Not allowed");
  const { postId, hidden } = z.object({ postId: z.string().uuid(), hidden: z.boolean() }).parse(await req.json());
  const r = await db().execute({ sql: "UPDATE posts SET hidden=? WHERE id=?", args: [hidden ? 1 : 0, postId] });
  return r.rowsAffected ? ok({ hidden }) : fail(404, "Not found");
});
