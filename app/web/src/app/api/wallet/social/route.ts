import { z } from "zod";
import { ok, fail, route } from "@/lib/api";
import { requestSocialToken, CircleError } from "@/lib/circle";

/** Start Google sign-in: the browser gives us its SDK deviceId; Circle returns the tokens it needs before redirecting to Google. */
export const POST = route("wallet-social", 8, async (req) => {
  const { deviceId } = z.object({ deviceId: z.string().min(8).max(200) }).parse(await req.json());
  try { return ok(await requestSocialToken(deviceId)); }
  catch (e) { if (e instanceof CircleError) return fail(e.status === 503 ? 503 : 400, e.status === 503 ? e.message : "Could not start Google sign-in. Try again."); throw e; }
});
