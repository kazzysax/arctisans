import { z } from "zod";
import { db } from "@/db";
import { ok, fail, route } from "@/lib/api";
import { requireSession, realAdmin, isAdminWallet } from "@/lib/session";
import { imageUrl } from "@/lib/images";
import { deletePostAndMedia } from "@/lib/postdelete";

// Team only. Review requests, and feature / unfeature / delete any post directly. No power over money.
const guard = (req: Request) => { const { wallet } = requireSession(req); return isAdminWallet(wallet) || !!realAdmin(req); };
const json = <T,>(s: unknown, d: T): T => { try { return JSON.parse(String(s)) as T; } catch { return d; } };

export const GET = route("admin-posts", 60, async (req) => {
  if (!guard(req)) return fail(403, "Team only");
  const r = (await db().execute(`SELECT q.id, q.kind, q.note, q.created_at, p.id AS post_id, p.body, p.images, p.video, u.handle
    FROM post_requests q JOIN posts p ON p.id=q.post_id JOIN users u ON u.wallet=p.author_wallet WHERE q.status='pending' ORDER BY q.created_at ASC LIMIT 50`)).rows;
  const lights = (await db().execute(`SELECT p.id, p.body, p.images, p.video, u.handle FROM posts p JOIN users u ON u.wallet=p.author_wallet
    WHERE p.highlight=1 AND p.hidden=0 ORDER BY p.created_at DESC LIMIT 30`)).rows;
  const card = (x: Record<string, unknown>) => ({ postId: String(x.post_id ?? x.id), handle: String(x.handle), body: String(x.body ?? "").slice(0, 140), thumb: json<string[]>(x.images, []).map(imageUrl)[0] ?? null, video: !!x.video });
  return ok({
    requests: r.map((x) => ({ id: String(x.id), kind: String(x.kind), note: x.note ? String(x.note) : null, at: Number(x.created_at), ...card(x) })),
    highlights: lights.map((x) => card(x)),
  });
});

export const POST = route("admin-posts-act", 60, async (req) => {
  if (!guard(req)) return fail(403, "Team only");
  const b = z.object({
    requestId: z.string().uuid().optional(), postId: z.string().uuid().optional(),
    action: z.enum(["approve", "decline", "highlight", "unhighlight", "delete"]),
  }).parse(await req.json());
  let postId = b.postId, kind: string | null = null;
  if (b.requestId) {
    const q = (await db().execute({ sql: "SELECT post_id, kind FROM post_requests WHERE id=? AND status='pending'", args: [b.requestId] })).rows[0];
    if (!q) return fail(404, "That request was already handled");
    postId = String(q.post_id); kind = String(q.kind);
  }
  if (!postId) return fail(400, "Missing post");
  const done = (status: string) => b.requestId ? db().execute({ sql: "UPDATE post_requests SET status=? WHERE id=?", args: [status, b.requestId!] }) : Promise.resolve();
  if (b.action === "decline") { await done("declined"); return ok({ declined: true }); }
  const action = b.action === "approve" ? (kind === "delete" ? "delete" : "highlight") : b.action;
  if (action === "highlight" || action === "unhighlight") {
    const r = await db().execute({ sql: "UPDATE posts SET highlight=? WHERE id=?", args: [action === "highlight" ? 1 : 0, postId] });
    if (!r.rowsAffected) return fail(404, "Post not found");
    await done("approved"); return ok({ highlight: action === "highlight" });
  }
  // delete: the post and what hangs off it. A post imported from X stays marked as imported, so it is not imported again.
  const g = await deletePostAndMedia(postId);
  if (!g.deleted) return fail(404, "Post not found");
  await done("approved");
  return ok(g);
});
