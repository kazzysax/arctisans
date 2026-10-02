import { z } from "zod";
import { ok, fail, route } from "@/lib/api";
import { initializeUser, CircleError } from "@/lib/circle";

/** After the code is verified: returns a wallet-creation challenge, or { existing: true } if this person already has a wallet. */
export const POST = route("wallet-init", 20, async (req) => {
  const { userToken } = z.object({ userToken: z.string().min(10).max(4000) }).parse(await req.json());
  try { return ok({ existing: false, ...(await initializeUser(userToken)) }); }
  catch (e) {
    if (e instanceof CircleError) {
      if (e.code === 155106) return ok({ existing: true }); // already initialised: just sign in
      return fail(e.status === 503 ? 503 : 401, e.status === 503 ? e.message : "Sign-in could not be verified");
    }
    throw e;
  }
});
