import { z } from "zod";
import { getAddress, keccak256, toBytes } from "viem";
import { db } from "@/db";
import { ok, fail, route } from "@/lib/api";
import { authenticate, checkSpend, recordSpend, idempotent } from "@/lib/agentauth";
import { tipCalls } from "@/lib/tx";
import { MIN_TIP } from "@/lib/money";

const B = z.object({ to: z.string().regex(/^0x[a-fA-F0-9]{40}$/), amount: z.number().int().min(MIN_TIP).max(100_000_000) });

/** Signed request (money scope). Caps are checked BEFORE building the call. The agent wallet then signs/sends it. */
export const POST = route("v1-tip", 60, async (req) => {
  const raw = await req.text();
  const ctx = await authenticate({ method: "POST", url: req.url, headers: req.headers, body: raw }, "tip");
  const b = B.parse(JSON.parse(raw));
  if (b.to.toLowerCase() === ctx.agentWallet) return fail(400, "An agent cannot tip itself");
  const dest = await db().execute({ sql: "SELECT wallet FROM users WHERE wallet=?", args: [b.to.toLowerCase()] });
  if (!dest.rows.length) return fail(404, "Recipient has no profile");
  const out = await idempotent(ctx.keyId, req.headers.get("idempotency-key"), async () => {
    await checkSpend(ctx, b.amount);
    await recordSpend(ctx, b.amount, `tip:${b.to}`);
    return { calls: tipCalls(getAddress(b.to), b.amount, keccak256(toBytes("profile"))) };
  });
  return ok(out);
});
