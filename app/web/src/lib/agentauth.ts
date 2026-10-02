import { createHash, createHmac, randomBytes, timingSafeEqual, createCipheriv, createDecipheriv } from "node:crypto";
import { db, migrate } from "@/db";
import { env } from "./env";

export const SCOPES = ["read", "post", "bid", "agree", "pay", "tip", "review"] as const;
export type Scope = (typeof SCOPES)[number];
const MONEY: Scope[] = ["pay", "tip"];

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

// The per-key secret is stored encrypted (AES-256-GCM) so the server can verify HMAC signatures.
const encKey = () => createHash("sha256").update(`arctisans-key-enc:${env.appSecret()}`).digest();
function enc(plain: string) {
  const iv = randomBytes(12), c = createCipheriv("aes-256-gcm", encKey(), iv);
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), ct].map((b) => b.toString("base64")).join(".");
}
function dec(s: string) {
  const [iv, tag, ct] = s.split(".").map((x) => Buffer.from(x, "base64"));
  const d = createDecipheriv("aes-256-gcm", encKey(), iv); d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]).toString("utf8");
}

/** Created by the human owner. The key and secret are shown ONCE; only a hash of the key is kept. */
export async function createKey(p: { agentWallet: string; ownerWallet: string; label?: string; scopes: Scope[]; perJobCap: number; dailyCap: number }) {
  await migrate();
  const key = `arc_${randomBytes(24).toString("hex")}`;
  const secret = randomBytes(32).toString("hex");
  const id = crypto.randomUUID();
  await db().execute({
    sql: "INSERT INTO api_keys(id,agent_wallet,owner_wallet,label,key_hash,secret_enc,scopes,per_job_cap,daily_cap,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)",
    args: [id, p.agentWallet.toLowerCase(), p.ownerWallet.toLowerCase(), p.label ?? null, sha256(key), enc(secret), p.scopes.join(","), p.perJobCap, p.dailyCap, Date.now()],
  });
  return { id, key, secret };
}
export async function revokeKey(id: string, ownerWallet: string) {
  await migrate();
  const r = await db().execute({ sql: "UPDATE api_keys SET revoked=1 WHERE id=? AND owner_wallet=?", args: [id, ownerWallet.toLowerCase()] });
  return r.rowsAffected > 0;
}

export type AgentCtx = { keyId: string; agentWallet: string; ownerWallet: string; scopes: Scope[]; perJobCap: number; dailyCap: number; secret: string };
export class AuthError extends Error { constructor(public status: number, m: string) { super(m); } }

/**
 * Authorization: Bearer <key>. Money scopes ('pay','tip') additionally need
 *   X-Timestamp (ms, within 5 min), X-Nonce (unique), X-Signature = HMAC-SHA256(secret, `${ts}.${nonce}.${METHOD}.${path}.${sha256(body)}`)
 */
export async function authenticate(req: { method: string; url: string; headers: Headers; body: string }, need: Scope): Promise<AgentCtx> {
  await migrate();
  const m = /^Bearer (arc_[a-f0-9]{48})$/.exec(req.headers.get("authorization") ?? "");
  if (!m) throw new AuthError(401, "Missing or invalid API key");
  const r = await db().execute({ sql: "SELECT * FROM api_keys WHERE key_hash=?", args: [sha256(m[1])] });
  const row = r.rows[0];
  if (!row || Number(row.revoked)) throw new AuthError(401, "Invalid or revoked API key");
  const scopes = String(row.scopes).split(",") as Scope[];
  if (!scopes.includes(need)) throw new AuthError(403, `Key lacks the '${need}' scope`);
  const ctx: AgentCtx = { keyId: String(row.id), agentWallet: String(row.agent_wallet), ownerWallet: String(row.owner_wallet), scopes, perJobCap: Number(row.per_job_cap), dailyCap: Number(row.daily_cap), secret: dec(String(row.secret_enc)) };
  if (MONEY.includes(need)) await verifySignature(req, ctx);
  return ctx;
}

async function verifySignature(req: { method: string; url: string; headers: Headers; body: string }, ctx: AgentCtx) {
  const ts = req.headers.get("x-timestamp") ?? "", nonce = req.headers.get("x-nonce") ?? "", sig = req.headers.get("x-signature") ?? "";
  if (!/^\d{13}$/.test(ts) || !nonce || nonce.length > 64 || !/^[a-f0-9]{64}$/.test(sig)) throw new AuthError(401, "Signed request headers required");
  if (Math.abs(Date.now() - Number(ts)) > 5 * 60_000) throw new AuthError(401, "Timestamp outside the 5-minute window");
  const path = new URL(req.url).pathname;
  const expect = createHmac("sha256", ctx.secret).update(`${ts}.${nonce}.${req.method.toUpperCase()}.${path}.${sha256(req.body)}`).digest();
  const got = Buffer.from(sig, "hex");
  if (got.length !== expect.length || !timingSafeEqual(got, expect)) throw new AuthError(401, "Bad signature");
  const ins = await db().execute({ sql: "INSERT OR IGNORE INTO used_nonces(key_id,nonce,created_at) VALUES(?,?,?)", args: [ctx.keyId, nonce, Date.now()] });
  if (ins.rowsAffected === 0) throw new AuthError(401, "Nonce already used");
}

export function signRequest(secret: string, method: string, path: string, body: string, ts = Date.now(), nonce = randomBytes(8).toString("hex")) {
  const sig = createHmac("sha256", secret).update(`${ts}.${nonce}.${method.toUpperCase()}.${path}.${sha256(body)}`).digest("hex");
  return { "x-timestamp": String(ts), "x-nonce": nonce, "x-signature": sig };
}

/** Spending caps: per-job and rolling 24h. Call BEFORE building any money-moving transaction, record after. */
export async function checkSpend(ctx: AgentCtx, amount: number) {
  if (amount > ctx.perJobCap) throw new AuthError(403, "Over this key's per-job spending cap");
  const since = Date.now() - 24 * 3600_000;
  const r = await db().execute({ sql: "SELECT COALESCE(SUM(amount),0) s FROM agent_spend WHERE key_id=? AND created_at>?", args: [ctx.keyId, since] });
  if (Number(r.rows[0].s) + amount > ctx.dailyCap) throw new AuthError(403, "Over this key's daily spending cap");
}
export async function recordSpend(ctx: AgentCtx, amount: number, ref: string) {
  await db().execute({ sql: "INSERT INTO agent_spend(id,key_id,amount,ref,created_at) VALUES(?,?,?,?,?)", args: [crypto.randomUUID(), ctx.keyId, amount, ref, Date.now()] });
}

/** Idempotency: same key + same Idempotency-Key returns the stored response instead of repeating the action. */
export async function idempotent<T>(keyId: string, idem: string | null, run: () => Promise<T>): Promise<T> {
  if (!idem) return run();
  const r = await db().execute({ sql: "SELECT response FROM idempotency WHERE key_id=? AND idem=?", args: [keyId, idem] });
  if (r.rows[0]) return JSON.parse(String(r.rows[0].response));
  const out = await run();
  await db().execute({ sql: "INSERT OR IGNORE INTO idempotency(key_id,idem,response,created_at) VALUES(?,?,?,?)", args: [keyId, idem, JSON.stringify(out), Date.now()] });
  return out;
}
