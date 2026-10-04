import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "@libsql/client";
import { setDb, migrate, db } from "@/db";
import { createKey, signRequest } from "@/lib/agentauth";
import sharp from "sharp";

const AG = "0x00000000000000000000000000000000000000a6", OW = "0x00000000000000000000000000000000000000c1", HU = "0x00000000000000000000000000000000000000a1";
let post: any, keyOk: { key: string; secret: string }, keyNoScope: { key: string; secret: string };
const call = (k: { key: string; secret: string }, body: object) => { const raw = JSON.stringify(body); return post(new Request("http://x.test/api/v1/posts", { method: "POST", body: raw, headers: { authorization: `Bearer ${k.key}`, ...signRequest(k.secret, "POST", "/api/v1/posts", raw) } })); };
beforeAll(async () => {
  process.env.APP_SECRET = "z".repeat(40);
  setDb(createClient({ url: ":memory:" })); await migrate();
  await db().execute({ sql: "INSERT INTO users(id,wallet,handle,display_name,kind,owner_wallet,created_at) VALUES('1',?,'bot','Bot','agent',?,1)", args: [AG, OW] });
  await db().execute({ sql: "INSERT INTO users(id,wallet,handle,display_name,kind,created_at) VALUES('2',?,'ada','Ada','human',1)", args: [HU] });
  keyOk = await createKey({ agentWallet: AG, ownerWallet: OW, scopes: ["read", "post"], perJobCap: 1e6, dailyCap: 1e6 });
  keyNoScope = await createKey({ agentWallet: AG, ownerWallet: OW, scopes: ["read"], perJobCap: 1e6, dailyCap: 1e6 });
  ({ POST: post } = await import("@/app/api/v1/posts/route"));
});
describe("agent posting", () => {
  it("a key with post scope can post a request and a picture post, authored by the agent", async () => {
    expect((await call(keyOk, { feed: "request", body: "Need a logo for my agent" })).status).toBe(201);
    const png = (await sharp({ create: { width: 64, height: 64, channels: 3, background: "#4af" } }).png().toBuffer()).toString("base64");
    expect((await call(keyOk, { feed: "work", body: "Demo", images: [png] })).status).toBe(201);
    const rows = (await db().execute("SELECT author_wallet, feed FROM posts")).rows; expect(rows).toHaveLength(2); expect(rows.every((r) => String(r.author_wallet) === AG)).toBe(true);
  });
  it("needs the post scope, pictures for work, and 5+ chars for a request", async () => {
    expect((await call(keyNoScope, { feed: "request", body: "Need a logo please" })).status).toBe(403);
    expect((await call(keyOk, { feed: "work", body: "no pictures" })).status).toBe(400);
    expect((await call(keyOk, { feed: "request", body: "hi" })).status).toBe(400);
  });
  it("unsigned post refused", async () => {
    const r = await post(new Request("http://x.test/api/v1/posts", { method: "POST", body: "{}", headers: { authorization: `Bearer ${keyOk.key}` } }));
    expect(r.status).toBe(401);
  });
});
