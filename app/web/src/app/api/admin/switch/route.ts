import { z } from "zod";
import { db } from "@/db";
import { ok, fail, route } from "@/lib/api";
import { requireSession, issueSession, issueAdminMark, realAdmin } from "@/lib/session";

const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
const cookie = (name: string, val: string, secs: number) => `${name}=${val}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${secs}${secure}`;

// GET: which profiles can I switch into? Admins only. Also reports whether I'm currently switched.
export const GET = route("admin-switch-list", 30, async (req) => {
  const me = requireSession(req).wallet;
  const admin = realAdmin(req);
  if (!admin) return fail(403, "Not allowed");
  const r = await db().execute({ sql: "SELECT wallet, handle, display_name, avatar, kind FROM users WHERE owner_wallet=? ORDER BY created_at ASC LIMIT 30", args: [admin] });
  const mine = await db().execute({ sql: "SELECT handle FROM users WHERE wallet=?", args: [admin] });
  return ok({
    acting: me !== admin, admin: { handle: mine.rows[0] ? String(mine.rows[0].handle) : null },
    profiles: r.rows.map((x) => ({ wallet: String(x.wallet), handle: String(x.handle), displayName: String(x.display_name), avatar: x.avatar ? String(x.avatar) : null, kind: String(x.kind), current: String(x.wallet) === me })),
  });
});

// POST { handle } switches into a profile this admin owns. POST { back: true } returns to the admin's own profile.
export const POST = route("admin-switch", 20, async (req) => {
  requireSession(req);
  const admin = realAdmin(req);
  if (!admin) return fail(403, "Not allowed");
  const b = z.object({ handle: z.string().max(40).optional(), back: z.boolean().optional() }).parse(await req.json());
  const res = ok({ ok: true });
  if (b.back) {
    res.headers.append("set-cookie", cookie("arc_session", issueSession(admin, 14), 14 * 86400));
    res.headers.append("set-cookie", cookie("arc_admin", "", 0));
    return res;
  }
  const t = await db().execute({ sql: "SELECT wallet FROM users WHERE lower(handle)=? AND owner_wallet=?", args: [(b.handle ?? "").toLowerCase(), admin] });
  if (!t.rows[0]) return fail(404, "You don't own that profile");
  res.headers.append("set-cookie", cookie("arc_session", issueSession(String(t.rows[0].wallet), 0.5), 12 * 3600));
  res.headers.append("set-cookie", cookie("arc_admin", issueAdminMark(admin, 12), 12 * 3600));
  return res;
});
