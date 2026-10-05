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

// ---- Admin "act as" ----
// An admin can switch into profiles they own (e.g. the official @arctisans). A second, separately-signed cookie remembers who
// the real admin is, so they can switch back. It is signed with a different context so it can never be used as a session.
export const isAdminWallet = (w: string) => (process.env.ADMIN_WALLETS ?? "").toLowerCase().split(",").map((s) => s.trim()).filter(Boolean).includes(w.toLowerCase());
const adminSig = (body: string) => createHmac("sha256", env.appSecret()).update(`admin-mark:${body}`).digest();
export function issueAdminMark(adminWallet: string, hours = 12): string {
  const body = b64(Buffer.from(JSON.stringify({ a: adminWallet.toLowerCase(), exp: Date.now() + hours * 3600_000 })));
  return `${body}.${b64(adminSig(body))}`;
}
export function readAdminMark(cookieHeader: string | null): { admin: string } | null {
  const m = /(?:^|;\s*)arc_admin=([^;]+)/.exec(cookieHeader ?? "");
  if (!m) return null;
  const [body, sig] = m[1].split(".");
  if (!body || !sig) return null;
  const expect = adminSig(body), got = Buffer.from(sig, "base64url");
  if (got.length !== expect.length || !timingSafeEqual(got, expect)) return null;
  try { const p = JSON.parse(Buffer.from(body, "base64url").toString()); return p.exp > Date.now() && isAdminWallet(String(p.a)) ? { admin: String(p.a) } : null; } catch { return null; }
}
/** The real admin behind this request: the signed-in wallet if it is an admin, or the admin who switched into another profile. */
export function realAdmin(req: Request): string | null {
  const s = readSession(req.headers.get("cookie"));
  if (s && isAdminWallet(s.wallet)) return s.wallet.toLowerCase();
  const mark = readAdminMark(req.headers.get("cookie"));
  return s && mark ? mark.admin : null;
}
