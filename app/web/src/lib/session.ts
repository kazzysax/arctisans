import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "./env";
import { AuthError } from "./agentauth";

/**
 * Session = the wallet address Circle authenticated for us, signed with HMAC.
 * The Circle login step (server-verified userToken -> wallet) calls issueSession(); everything else reads it.
 */
const b64 = (b: Buffer) => b.toString("base64url");
export function issueSession(wallet: string, days = 14): string {
  const body = b64(Buffer.from(JSON.stringify({ w: wallet.toLowerCase(), exp: Date.now() + days * 86400_000 })));
  return `${body}.${b64(createHmac("sha256", env.appSecret()).update(body).digest())}`;
}
export function readSession(cookieHeader: string | null): { wallet: string } | null {
  const m = /(?:^|;\s*)arc_session=([^;]+)/.exec(cookieHeader ?? "");
  if (!m) return null;
  const [body, sig] = m[1].split(".");
  if (!body || !sig) return null;
  const expect = createHmac("sha256", env.appSecret()).update(body).digest();
  const got = Buffer.from(sig, "base64url");
  if (got.length !== expect.length || !timingSafeEqual(got, expect)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString());
    return p.exp > Date.now() ? { wallet: String(p.w) } : null;
  } catch { return null; }
}
export function requireSession(req: Request): { wallet: string } {
  const s = readSession(req.headers.get("cookie"));
  if (!s) throw new AuthError(401, "Please sign in");
  return s;
}
