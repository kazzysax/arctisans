import { z } from "zod";
import { ok, fail, route } from "@/lib/api";
import { requireSession } from "@/lib/session";
import { arcWallet, contractChallenge, getTransaction, CircleError } from "@/lib/circle";
import { env } from "@/lib/env";

const ALLOWED = () => [env.escrow(), env.social()].filter(Boolean).map((a) => a.toLowerCase());

/**
 * Turn one onchain call into a Circle challenge for the signed-in user's own wallet.
 * Safety: only OUR contracts (escrow / social) or the USDC contract can be called, and the wallet must match the session.
 */
export const POST = route("wallet-challenge", 60, async (req) => {
  const { wallet } = requireSession(req);
  const b = z.object({ userToken: z.string().min(10).max(4000), to: z.string().regex(/^0x[a-fA-F0-9]{40}$/), data: z.string().regex(/^0x[a-fA-F0-9]*$/).max(20000) }).parse(await req.json());
  const { USDC } = await import("@/lib/chain");
  if (![...ALLOWED(), USDC.toLowerCase()].includes(b.to.toLowerCase())) return fail(400, "That contract isn't allowed");
  try {
    const w = await arcWallet(b.userToken);
    if (!w || w.address.toLowerCase() !== wallet) return fail(403, "Wallet does not match your session");
    return ok(await contractChallenge(b.userToken, w.id, b.to, b.data));
  } catch (e) {
    if (e instanceof CircleError) {
      console.error("[wallet-challenge] circle", e.status, e.code, e.message);
      if (e.status === 503) return fail(503, e.message);
      if (e.status === 401 || e.status === 403 || /token|expired|auth/i.test(e.message)) return fail(401, "REAUTH");
      return fail(400, `Circle could not prepare it: ${e.message}`);
    }
    throw e;
  }
});

/** Poll a submitted transaction until it has a hash (then the client calls /api/tx so the UI updates at once). */
export const GET = route("wallet-tx", 240, async (req) => {
  requireSession(req);
  const u = new URL(req.url), id = u.searchParams.get("id") ?? "", userToken = req.headers.get("x-user-token") ?? "";
  if (!/^[0-9a-f-]{20,60}$/i.test(id) || !userToken) return fail(400, "Missing transaction id");
  try { const { transaction: t } = await getTransaction(userToken, id); return ok({ state: t.state, txHash: t.txHash ?? null, error: t.errorReason ?? null }); }
  catch (e) { if (e instanceof CircleError) return fail(400, "Could not read the transaction"); throw e; }
});
