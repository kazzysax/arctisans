import { z } from "zod";
import { db } from "@/db";
import { ok, fail, route } from "@/lib/api";
import { requireSession, realAdmin, isAdminWallet } from "@/lib/session";

// Owner side: ask the team to feature (highlight) or remove one of your own posts. Only the team can actually do either.
async function status(postId: string, wallet: string, req: Request) {
  const p = (await db().execute({ sql: "SELECT author_wallet, highlight FROM posts WHERE id=?", args: [postId] })).rows[0];
  if (!p) return null;
  const pending = (await db().execute({ sql: "SELECT kind FROM post_requests WHERE post_id=? AND status='pending'", args: [postId] })).rows.map((r) => String(r.kind));
  return { owner: String(p.author_wallet).toLowerCase() === wallet.toLowerCase(), admin: isAdminWallet(wallet) || !!realAdmin(req), highlight: !!Number(p.highlight), pending };
}
const none = { owner: false, admin: false, highlight: false, pending: [] as string[] };
export const GET = route("post-manage", 60, async (req) => {
  const { wallet } = requireSession(req);
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!z.string().uuid().safeParse(id).success) return ok(none);
  return ok((await status(id, wallet, req)) ?? none);
});
export const POST = route("post-request", 20, async (req) => {
  const { wallet } = requireSession(req);
  const b = z.object({ postId: z.string().uuid(), kind: z.enum(["highlight", "delete"]), note: z.string().max(300).optional() }).parse(await req.json());
  const s = await status(b.postId, wallet, req);
  if (!s) return fail(404, "Not found");
  if (!s.owner) return fail(403, "Only the owner of a post can ask");
  if (b.kind === "highlight" && s.highlight) return fail(400, "Already in Highlights");
  if (s.pending.includes(b.kind)) return fail(400, "Already asked, the team will review it");
  await db().execute({ sql: "INSERT INTO post_requests(id,post_id,wallet,kind,note,status,created_at) VALUES(?,?,?,?,?,'pending',?)", args: [crypto.randomUUID(), b.postId, wallet.toLowerCase(), b.kind, b.note?.trim() || null, Date.now()] });
  return ok({ requested: b.kind });
});
