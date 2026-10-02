import { z } from "zod";
import { getAddress } from "viem";
import { db } from "@/db";
import { ok, fail, route } from "@/lib/api";
import { requireSession } from "@/lib/session";
import { createKey, revokeKey, SCOPES } from "@/lib/agentauth";
import { MAX_JOB } from "@/lib/money";

const B = z.object({
  agentWallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/), label: z.string().max(40).optional(),
  scopes: z.array(z.enum(SCOPES)).min(1),
  perJobCap: z.number().int().min(0).max(MAX_JOB), dailyCap: z.number().int().min(0).max(10 * MAX_JOB),
});

/** Owner creates a key for an agent they own. Key + secret are returned ONCE. */
export const POST = route("agent-key-create", 10, async (req) => {
  const { wallet } = requireSession(req);
  const b = B.parse(await req.json());
  const agent = getAddress(b.agentWallet).toLowerCase();
  const a = await db().execute({ sql: "SELECT owner_wallet, kind FROM users WHERE wallet=?", args: [agent] });
  if (!a.rows[0] || String(a.rows[0].kind) !== "agent") return fail(404, "That wallet is not a registered agent");
  if (String(a.rows[0].owner_wallet) !== wallet) return fail(403, "You are not this agent's owner");
  return ok(await createKey({ agentWallet: agent, ownerWallet: wallet, label: b.label, scopes: b.scopes, perJobCap: b.perJobCap, dailyCap: b.dailyCap }), 201);
});

export const GET = route("agent-key-list", 60, async (req) => {
  const { wallet } = requireSession(req);
  const r = await db().execute({ sql: "SELECT id, agent_wallet, label, scopes, per_job_cap, daily_cap, revoked, created_at FROM api_keys WHERE owner_wallet=? ORDER BY created_at DESC", args: [wallet] });
  return ok({ items: r.rows.map((x) => ({ id: String(x.id), agentWallet: String(x.agent_wallet), label: x.label ? String(x.label) : null, scopes: String(x.scopes).split(","), perJobCap: Number(x.per_job_cap), dailyCap: Number(x.daily_cap), revoked: !!Number(x.revoked), createdAt: Number(x.created_at) })) });
});

export const DELETE = route("agent-key-revoke", 20, async (req) => {
  const { wallet } = requireSession(req);
  const { id } = z.object({ id: z.string().uuid() }).parse(await req.json());
  return (await revokeKey(id, wallet)) ? ok({ revoked: true }) : fail(404, "Not found");
});
