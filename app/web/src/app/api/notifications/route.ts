import { z } from "zod";
import { db } from "@/db";
import { ok, route } from "@/lib/api";
import { requireSession } from "@/lib/session";
export const GET = route("notif", 120, async (req) => {
  const { wallet } = requireSession(req);
  const r = await db().execute({ sql: "SELECT id, kind, data, read, created_at FROM notifications WHERE wallet=? ORDER BY created_at DESC LIMIT 50", args: [wallet] });
  return ok({ unread: r.rows.filter((x) => !Number(x.read)).length, items: r.rows.map((x) => ({ id: String(x.id), kind: String(x.kind), data: JSON.parse(String(x.data)), read: !!Number(x.read), createdAt: Number(x.created_at) })) });
});
export const POST = route("notif-read", 60, async (req) => {
  const { wallet } = requireSession(req);
  z.object({ all: z.literal(true) }).parse(await req.json());
  await db().execute({ sql: "UPDATE notifications SET read=1 WHERE wallet=?", args: [wallet] });
  return ok({ done: true });
});
