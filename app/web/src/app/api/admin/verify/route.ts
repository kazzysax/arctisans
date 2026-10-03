import { z } from "zod";
import { db } from "@/db";
import { ok, fail, route } from "@/lib/api";
import { requireSession } from "@/lib/session";
import { getVerifyStatus, getProfile } from "@/lib/queries";

// Team only (wallets in ADMIN_WALLETS). Grants/removes the Verified seal and the separate Founding mark. No power over money.
const isAdmin = (w: string) => (process.env.ADMIN_WALLETS ?? "").toLowerCase().split(",").map((s) => s.trim()).filter(Boolean).includes(w);

// People waiting for review, with how they measure up.
export const GET = route("admin-verify-list", 30, async (req) => {
  const { wallet } = requireSession(req);
  if (!isAdmin(wallet)) return fail(403, "Not allowed");
  const r = await db().execute("SELECT handle FROM users WHERE verify_requested=1 AND verified=0 ORDER BY created_at DESC LIMIT 50");
  const out = [];
  for (const x of r.rows) {
    const p = await getProfile(String(x.handle));
    if (p) out.push({ handle: p.handle, displayName: p.displayName, links: p.links, ...(await getVerifyStatus(p.wallet, p.createdAt, p.links)) });
  }
  const q = new URL(req.url).searchParams.get("q")?.trim().toLowerCase();
  let found: { handle: string; displayName: string; verified: boolean; founding: boolean }[] = [];
  if (q) {
    const f = await db().execute({ sql: "SELECT handle, display_name, verified, founding FROM users WHERE lower(handle) LIKE ? OR lower(display_name) LIKE ? LIMIT 10", args: [`%${q}%`, `%${q}%`] });
    found = f.rows.map((x) => ({ handle: String(x.handle), displayName: String(x.display_name), verified: !!Number(x.verified), founding: !!Number(x.founding) }));
  }
  return ok({ waiting: out, found });
});

export const POST = route("admin-verify", 30, async (req) => {
  const { wallet } = requireSession(req);
  if (!isAdmin(wallet)) return fail(403, "Not allowed");
  const b = z.object({ handle: z.string().min(3).max(20), action: z.enum(["verify", "unverify", "founding", "unfounding", "decline"]) }).parse(await req.json());
  if (b.action === "decline") {
    const d = await db().execute({ sql: "UPDATE users SET verify_requested=0 WHERE lower(handle)=?", args: [b.handle.toLowerCase()] });
    return d.rowsAffected ? ok({ handle: b.handle, declined: true }) : fail(404, "No such user");
  }
  const col = b.action.endsWith("founding") ? "founding" : "verified";
  const val = b.action === "verify" || b.action === "founding" ? 1 : 0;
  const r = await db().execute({ sql: `UPDATE users SET ${col}=?, verify_requested=0 WHERE lower(handle)=?`, args: [val, b.handle.toLowerCase()] });
  return r.rowsAffected ? ok({ handle: b.handle, [col]: !!val }) : fail(404, "No such user");
});
