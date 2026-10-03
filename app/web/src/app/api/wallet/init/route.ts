import { z } from "zod";
import { ok, fail, route } from "@/lib/api";
import { initializeUser, createEoaWallet, listWallets, CircleError } from "@/lib/circle";

/** After the code is verified: returns a wallet-creation challenge, or { existing: true } if this person already has a wallet. */
export const POST = route("wallet-init", 20, async (req) => {
  const { userToken } = z.object({ userToken: z.string().min(10).max(4000) }).parse(await req.json());
  try { return ok({ existing: false, ...(await initializeUser(userToken)) }); }
  catch (e) {
    if (e instanceof CircleError) {
      if (e.code === 155106) { // already initialised: sign in, adding a self-paying wallet if they only have the old sponsored-fee type
        try {
          const ws = (await listWallets(userToken)) as { blockchain: string; accountType?: string }[];
          if (!ws.some((w) => w.blockchain.startsWith("ARC") && w.accountType === "EOA")) return ok({ existing: false, ...(await createEoaWallet(userToken)) });
        } catch { /* fall through to a normal sign-in */ }
        return ok({ existing: true });
      }
      return fail(e.status === 503 ? 503 : 401, e.status === 503 ? e.message : "Sign-in could not be verified");
    }
    throw e;
  }
});
