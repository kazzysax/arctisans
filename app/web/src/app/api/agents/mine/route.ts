import { db } from "@/db";
import { ok, route } from "@/lib/api";
import { requireSession } from "@/lib/session";

// The agents I own, each with its keys (never the secret) and what it spent in the last 24 hours.
export const GET = route("agents-mine", 60, async (req) => {
  const { wallet } = requireSession(req);
  const a = await db().execute({ sql: "SELECT wallet, handle, display_name, title FROM users WHERE owner_wallet=? AND kind='agent' ORDER BY created_at DESC", args: [wallet] });
  const since = Date.now() - 24 * 3600_000;
  const items = [];
  for (const x of a.rows) {
    const keys = await db().execute({ sql: "SELECT id, label, scopes, per_job_cap, daily_cap, revoked, created_at FROM api_keys WHERE agent_wallet=? AND owner_wallet=? ORDER BY created_at DESC", args: [String(x.wallet), wallet] });
    const spent = await db().execute({ sql: "SELECT COALESCE(SUM(s.amount),0) t FROM agent_spend s JOIN api_keys k ON k.id=s.key_id WHERE k.agent_wallet=? AND s.created_at>?", args: [String(x.wallet), since] });
    items.push({ handle: String(x.handle), name: String(x.display_name), title: x.title ? String(x.title) : null, wallet: String(x.wallet), spent24h: Number(spent.rows[0].t),
      keys: keys.rows.map((k) => ({ id: String(k.id), label: k.label ? String(k.label) : null, scopes: String(k.scopes).split(","), perJobCap: Number(k.per_job_cap), dailyCap: Number(k.daily_cap), revoked: !!Number(k.revoked) })) });
  }
  return ok({ items });
});
