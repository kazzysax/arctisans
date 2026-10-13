import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "@libsql/client";
import { setDb, migrate, db } from "@/db";
import { takePayment, nativeNanoOn, requirementsFor } from "@/lib/native/nano";
import { NANO_PRICE, NATIVE } from "@/lib/native/agents";

beforeAll(async () => { setDb(createClient({ url: "file::memory:" })); await migrate(); });

describe("native agents over nanopayments", () => {
  it("every native agent has a price, far below its $0.10 escrow price", () => {
    for (const a of NATIVE) { expect(NANO_PRICE[a.handle]).toBeGreaterThan(0); expect(NANO_PRICE[a.handle]).toBeLessThan(a.price); }
  });
  it("is off unless NATIVE_NANO=1", () => { delete process.env.NATIVE_NANO; expect(nativeNanoOn()).toBe(false); process.env.NATIVE_NANO = "1"; expect(nativeNanoOn()).toBe(true); delete process.env.NATIVE_NANO; });
  it("a request without payment gets a 402 naming the agent's own wallet and price", async () => {
    const to = "0x" + "ab".repeat(20);
    const r = await takePayment(new Request("https://x.test/api/native/hire/portrait", { method: "POST" }), "portrait", to) as Response;
    expect(r.status).toBe(402);
    const h = JSON.parse(Buffer.from(r.headers.get("payment-required")!, "base64").toString());
    expect(h.accepts[0]).toMatchObject({ payTo: to, amount: String(NANO_PRICE.portrait), network: "eip155:5042" });
  });
  it("a forged payment is refused and an unknown agent is a 404", async () => {
    const bad = await takePayment(new Request("https://x.test/x", { method: "POST", headers: { "payment-signature": "@@@" } }), "brief", "0x" + "cd".repeat(20)) as Response;
    expect(bad.status).toBe(402);
    expect(((await takePayment(new Request("https://x.test/x", { method: "POST" }), "nobody", "0x1")) as Response).status).toBe(404);
  });
  it("requirements carry the Gateway contract", () => { expect(requirementsFor("0x1", 10).extra.name).toBe("GatewayWalletBatched"); });
  it("the ledger refuses a second payment for the same job and helper", async () => {
    const ins = (id: string) => db().execute({ sql: "INSERT INTO native_nano(id,job_id,from_handle,to_handle,amount_micro,result,tx,network,created_at) VALUES(?,?,?,?,?,?,?,?,?)", args: [id, "j1", "cvdoctor", "portrait", 20000, "pic", null, "eip155:5042", 1] });
    await ins("a"); await expect(ins("b")).rejects.toThrow();
  });
});
