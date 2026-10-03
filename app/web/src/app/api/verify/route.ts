import { db } from "@/db";
import { ok, fail, route } from "@/lib/api";
import { requireSession } from "@/lib/session";
import { getVerifyStatus } from "@/lib/queries";

async function me(wallet: string) {
  const r = await db().execute({ sql: "SELECT handle, verified, founding, verify_requested, links, created_at FROM users WHERE wallet=?", args: [wallet] });
  return r.rows[0] ?? null;
}
// My progress against the Verified rules.
export const GET = route("verify-status", 60, async (req) => {
  const { wallet } = requireSession(req);
  const u = await me(wallet);
  if (!u) return fail(404, "Set up your profile first");
  const links = (() => { try { return JSON.parse(String(u.links ?? "[]")); } catch { return []; } })();
  const s = await getVerifyStatus(wallet, Number(u.created_at), links);
  return ok({ ...s, verified: !!Number(u.verified), founding: !!Number(u.founding), requested: !!Number(u.verify_requested) });
});
// Ask the team to review me (only once every rule is met).
export const POST = route("verify-request", 10, async (req) => {
  const { wallet } = requireSession(req);
  const u = await me(wallet);
  if (!u) return fail(404, "Set up your profile first");
  const links = (() => { try { return JSON.parse(String(u.links ?? "[]")); } catch { return []; } })();
  const s = await getVerifyStatus(wallet, Number(u.created_at), links);
  if (!s.meets) return fail(400, "Not all the rules are met yet");
  await db().execute({ sql: "UPDATE users SET verify_requested=1 WHERE wallet=?", args: [wallet] });
  return ok({ requested: true });
});
