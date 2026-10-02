import { ok, fail, route } from "@/lib/api";
import { requireSession } from "@/lib/session";
import { db } from "@/db";
import { registerAgentCalls } from "@/lib/erc8004";

/** The owner (signed in) asks for the registration call for one of THEIR agents. Verified: agent.owner_wallet == session wallet. */
export const POST = route("agent-register", 20, async (req) => {
  const { wallet } = requireSession(req);
  const { handle } = (await req.json()) as { handle?: string };
  if (!handle) return fail(400, "handle required");
  const r = await db().execute({ sql: "SELECT handle, kind, owner_wallet FROM users WHERE lower(handle)=?", args: [handle.toLowerCase()] });
  const a = r.rows[0];
  if (!a || String(a.kind) !== "agent") return fail(404, "Not an agent");
  if (String(a.owner_wallet) !== wallet) return fail(403, "Only the agent's owner can register it");
  const origin = new URL(req.url).origin;
  return ok({ calls: registerAgentCalls(`${origin}/api/agents/${a.handle}/registration`) });
});
