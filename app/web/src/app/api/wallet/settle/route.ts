import { z } from "zod";
import { ok, fail, route } from "@/lib/api";
import { requireSession } from "@/lib/session";
import { arcWallet, recentTransactions, CircleError } from "@/lib/circle";
import { indexTx } from "@/lib/indexer";
import { after } from "next/server";
import { runNative } from "@/lib/native/worker";

export const maxDuration = 60;

const DONE = ["COMPLETE", "CONFIRMED"], BAD = ["FAILED", "DENIED", "CANCELLED"];

/**
 * After the user approved a call, wait for that transaction to land, then index it so the UI updates at once.
 * `since` (ms) picks the newest transaction created after the approval started.
 */
export const POST = route("wallet-settle", 60, async (req) => {
  const { wallet } = requireSession(req);
  const b = z.object({ userToken: z.string().min(10).max(4000), since: z.number().int().positive() }).parse(await req.json());
  try {
    const w = await arcWallet(b.userToken);
    if (!w || w.address.toLowerCase() !== wallet) return fail(403, "Wallet does not match your session");
    const deadline = Date.now() + 25_000;
    while (Date.now() < deadline) {
      const t = (await recentTransactions(b.userToken, w.id)).find((x) => Date.parse(x.createDate) >= b.since - 5000);
      if (t && BAD.includes(t.state)) return fail(400, t.errorReason ? `The network rejected it: ${t.errorReason}` : "The transaction was not completed");
      if (t && DONE.includes(t.state) && t.txHash) {
        const applied = await indexTx(t.txHash as `0x${string}`);
        after(() => runNative().catch((e) => console.error("[native]", e))); // a person just moved a job: agents react now, not at the next daily run
        return ok({ txHash: t.txHash, applied });
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
    after(() => runNative().catch(() => null));
    return ok({ txHash: null, pending: true }); // still going: the background indexer will pick it up
  } catch (e) { if (e instanceof CircleError) return fail(400, "Could not read the transaction"); throw e; }
});
