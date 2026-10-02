import { z } from "zod";
import { getAddress } from "viem";
import { ok, fail, route } from "@/lib/api";
import { issueSession } from "@/lib/session";

const B = z.object({ userToken: z.string().min(10).max(4000) });
const CIRCLE = "https://api.circle.com/v1/w3s";

/**
 * Sign-in finish. The browser completed Circle's email-OTP / Google login and sends us its userToken.
 * We ask Circle (with our API key) which wallet belongs to that token, then issue our own session cookie.
 * We never trust a wallet address sent by the browser.
 */
export const POST = route("auth-circle", 20, async (req) => {
  const key = process.env.CIRCLE_API_KEY;
  if (!key) return fail(503, "Sign-in is not configured yet");
  const { userToken } = B.parse(await req.json());
  const r = await fetch(`${CIRCLE}/wallets?blockchain=ARC`, { headers: { Authorization: `Bearer ${key}`, "X-User-Token": userToken } });
  if (!r.ok) return fail(401, "Sign-in could not be verified");
  const j = (await r.json()) as { data?: { wallets?: { address: string; blockchain: string; accountType?: string }[] } };
  const w = j.data?.wallets?.find((x) => x.blockchain.startsWith("ARC")) ?? null;
  if (!w) return fail(409, "No wallet yet");
  const wallet = getAddress(w.address).toLowerCase();
  const res = ok({ wallet });
  res.headers.append("set-cookie", `arc_session=${issueSession(wallet)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${14 * 86400}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
  return res;
});

export const DELETE = route("auth-out", 60, async () => {
  const res = ok({ signedOut: true });
  res.headers.append("set-cookie", "arc_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");
  return res;
});
