import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "@libsql/client";
import { setDb, migrate, db } from "@/db";
import { createKey, signRequest } from "@/lib/agentauth";

const AG = "0x00000000000000000000000000000000000000a6", OW = "0x00000000000000000000000000000000000000c1", ADA = "0x00000000000000000000000000000000000000a1";
let tip: any, jobs: any, work: any;
const signed = async (k: { key: string; secret: string }, path: string, body: object, extra: Record<string, string> = {}) => {
  const raw = JSON.stringify(body);
  return new Request("http://x.test" + path, { method: "POST", body: raw, headers: { authorization: `Bearer ${k.key}`, ...signRequest(k.secret, "POST", path, raw), ...extra } });
};
beforeAll(async () => {
  process.env.APP_SECRET = "z".repeat(40);
  process.env.ESCROW_ADDRESS = "0x00000000000000000000000000000000000000e5"; process.env.SOCIAL_ADDRESS = "0x00000000000000000000000000000000000000f5";
  setDb(createClient({ url: ":memory:" })); await migrate();
  await db().execute({ sql: "INSERT INTO users(id,wallet,handle,display_name,created_at) VALUES('1',?, 'ada','Ada',1)", args: [ADA] });
  ({ POST: tip } = await import("@/app/api/v1/tip/route")); ({ POST: jobs } = await import("@/app/api/v1/jobs/route")); ({ GET: work } = await import("@/app/api/v1/work/route"));
});
describe("agent API v1", () => {
  it("unsigned money call refused; signed one builds calls", async () => {
    const k = await createKey({ agentWallet: AG, ownerWallet: OW, scopes: ["tip", "agree", "read"], perJobCap: 20e6, dailyCap: 25e6 });
    expect((await tip(new Request("http://x.test/api/v1/tip", { method: "POST", body: "{}", headers: { authorization: `Bearer ${k.key}` } }))).status).toBe(401);
    const r = await tip(await signed(k, "/api/v1/tip", { to: ADA, amount: 2_000_000 })); expect(r.status).toBe(200); expect((await r.json()).calls).toHaveLength(2);
  });
  it("daily cap stops the agent; idempotent retry does not double-spend", async () => {
    const k = await createKey({ agentWallet: AG, ownerWallet: OW, scopes: ["tip"], perJobCap: 20e6, dailyCap: 5e6 });
    expect((await tip(await signed(k, "/api/v1/tip", { to: ADA, amount: 3_000_000 }, { "idempotency-key": "a1" }))).status).toBe(200);
    expect((await tip(await signed(k, "/api/v1/tip", { to: ADA, amount: 3_000_000 }, { "idempotency-key": "a1" }))).status).toBe(200); // retry, same result
    expect((await tip(await signed(k, "/api/v1/tip", { to: ADA, amount: 3_000_000 }, { "idempotency-key": "a2" }))).status).toBe(403); // 6 > 5 daily
  });
  it("agent can hire (spend-capped) and be hired (no spend)", async () => {
    const k = await createKey({ agentWallet: AG, ownerWallet: OW, scopes: ["agree", "read"], perJobCap: 40e6, dailyCap: 50e6 });
    const dl = Math.floor(Date.now() / 1000) + 86400 * 5;
    const job = (iAm: string, total: number) => ({ counterparty: ADA, iAm, title: "Translate docs", deliverables: ["10 pages"], doneMeans: "Reviewed and sent", deadline: dl, total });
    expect((await jobs(await signed(k, "/api/v1/jobs", job("client", 30e6)))).status).toBe(201);
    expect((await jobs(await signed(k, "/api/v1/jobs", job("client", 50e6)))).status).toBe(403); // over per-job cap
    expect((await jobs(await signed(k, "/api/v1/jobs", job("artisan", 90e6)))).status).toBe(201); // being hired is not spending
  });
  it("read scope can browse feeds", async () => {
    const k = await createKey({ agentWallet: AG, ownerWallet: OW, scopes: ["read"], perJobCap: 1, dailyCap: 1 });
    const r = await work(new Request("http://x.test/api/v1/work?feed=request", { headers: { authorization: `Bearer ${k.key}` } })); expect(r.status).toBe(200);
  });
});
