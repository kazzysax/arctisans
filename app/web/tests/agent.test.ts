import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "@libsql/client";
import { setDb, migrate } from "@/db";
import { createKey, revokeKey, authenticate, signRequest, checkSpend, recordSpend, idempotent, AuthError, sha256 } from "@/lib/agentauth";
import { allow } from "@/lib/ratelimit";

const AG = "0x00000000000000000000000000000000000000a6", OW = "0x00000000000000000000000000000000000000c1";
const mk = (method: string, path: string, body: string, headers: Record<string, string>) =>
  ({ method, url: `https://x.test${path}`, headers: new Headers(headers), body });

beforeAll(async () => {
  process.env.APP_SECRET = "x".repeat(40);
  setDb(createClient({ url: ":memory:" }));
  await migrate();
});

describe("agent API auth", () => {
  it("stores only a hash of the key", async () => {
    const k = await createKey({ agentWallet: AG, ownerWallet: OW, scopes: ["read"], perJobCap: 1, dailyCap: 1 });
    const { db } = await import("@/db");
    const r = await db().execute("SELECT key_hash, secret_enc FROM api_keys");
    expect(JSON.stringify(r.rows)).not.toContain(k.key);
    expect(JSON.stringify(r.rows)).not.toContain(k.secret);
    expect(JSON.stringify(r.rows)).toContain(sha256(k.key));
  });
  it("read scope needs only the bearer key; wrong key / missing scope refused", async () => {
    const k = await createKey({ agentWallet: AG, ownerWallet: OW, scopes: ["read"], perJobCap: 1, dailyCap: 1 });
    expect((await authenticate(mk("GET", "/api/v1/work", "", { authorization: `Bearer ${k.key}` }), "read")).agentWallet).toBe(AG);
    await expect(authenticate(mk("GET", "/x", "", { authorization: "Bearer arc_" + "0".repeat(48) }), "read")).rejects.toBeInstanceOf(AuthError);
    await expect(authenticate(mk("POST", "/x", "", { authorization: `Bearer ${k.key}` }), "post")).rejects.toMatchObject({ status: 403 });
  });
  it("money calls need a valid signature; replay, tamper, stale all refused", async () => {
    const k = await createKey({ agentWallet: AG, ownerWallet: OW, scopes: ["pay"], perJobCap: 1, dailyCap: 1 });
    const body = JSON.stringify({ amount: 5 }), path = "/api/v1/jobs/1/fund";
    const h = { authorization: `Bearer ${k.key}`, ...signRequest(k.secret, "POST", path, body) };
    expect((await authenticate(mk("POST", path, body, h), "pay")).keyId).toBe(k.id);
    await expect(authenticate(mk("POST", path, body, h), "pay")).rejects.toThrow(/Nonce/); // replay
    const h2 = { authorization: `Bearer ${k.key}`, ...signRequest(k.secret, "POST", path, body) };
    await expect(authenticate(mk("POST", path, JSON.stringify({ amount: 500 }), h2), "pay")).rejects.toThrow(/signature/i); // tampered body
    const h3 = { authorization: `Bearer ${k.key}`, ...signRequest(k.secret, "POST", path, body, Date.now() - 10 * 60_000) };
    await expect(authenticate(mk("POST", path, body, h3), "pay")).rejects.toThrow(/window/);
    await expect(authenticate(mk("POST", path, body, { authorization: `Bearer ${k.key}` }), "pay")).rejects.toThrow(/Signed/);
  });
  it("revoked keys stop working", async () => {
    const k = await createKey({ agentWallet: AG, ownerWallet: OW, scopes: ["read"], perJobCap: 1, dailyCap: 1 });
    expect(await revokeKey(k.id, "0xSOMEONEELSE")).toBe(false);
    expect(await revokeKey(k.id, OW)).toBe(true);
    await expect(authenticate(mk("GET", "/x", "", { authorization: `Bearer ${k.key}` }), "read")).rejects.toThrow(/revoked/);
  });
  it("per-job and rolling daily caps hold", async () => {
    const k = await createKey({ agentWallet: AG, ownerWallet: OW, scopes: ["pay"], perJobCap: 20e6, dailyCap: 30e6 });
    const ctx = { keyId: k.id, agentWallet: AG, ownerWallet: OW, scopes: ["pay" as const], perJobCap: 20e6, dailyCap: 30e6, secret: "" };
    await expect(checkSpend(ctx, 21e6)).rejects.toThrow(/per-job/);
    await checkSpend(ctx, 20e6); await recordSpend(ctx, 20e6, "job1");
    await expect(checkSpend(ctx, 11e6)).rejects.toThrow(/daily/);
    await checkSpend(ctx, 10e6);
  });
  it("idempotency returns the first result, runs once", async () => {
    let n = 0;
    const run = async () => ({ n: ++n });
    expect(await idempotent("k", "abc", run)).toEqual({ n: 1 });
    expect(await idempotent("k", "abc", run)).toEqual({ n: 1 });
    expect(n).toBe(1);
  });
  it("rate limiter blocks after the limit then resets", async () => {
    for (let i = 0; i < 3; i++) expect(await allow("t1", 3, 60_000)).toBe(true);
    expect(await allow("t1", 3, 60_000)).toBe(false);
    expect(await allow("t2", 3, 1)).toBe(true);
  });
});
