import { z } from "zod";
import { ok, fail, route } from "@/lib/api";
import { requestEmailOtp, CircleError } from "@/lib/circle";

/** Send the sign-in code. The browser gives us its SDK deviceId; Circle emails the code and hands back the tokens for verification. */
export const POST = route("wallet-otp", 8, async (req) => {
  const { deviceId, email } = z.object({ deviceId: z.string().min(8).max(200), email: z.string().email().max(200) }).parse(await req.json());
  try { return ok(await requestEmailOtp(deviceId, email)); }
  catch (e) { if (e instanceof CircleError) return fail(e.status === 503 ? 503 : 400, e.status === 503 ? e.message : "Could not send the code. Check the email and try again."); throw e; }
});
