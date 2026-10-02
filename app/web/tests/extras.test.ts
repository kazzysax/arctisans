import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "@libsql/client";
import { decodeFunctionData } from "viem";
import { setDb, migrate, db } from "@/db";
import { issueSession } from "@/lib/session";
import { applyEvent } from "@/lib/indexer";
import { dueJobs } from "@/lib/keeper";
import { identityAbi } from "@/lib/erc8004";

const OW = "0x00000000000000000000000000000000000000c1", AG = "0x00000000000000000000000000000000000000a6", ADA = "0x00000000000000000000000000000000000000a1", ADMIN = "0x00000000000000000000000000000000000000ad";
const cookie = (w: string) => ({ cookie: `arc_session=${issueSession(w)}`, "content-type": "application/json" });
let reg: any, regFile: any, keys: any, hide: any, feed: any, og: any;
const run = (h: any, url: string, init: RequestInit = {}) => h(new Request("http://x.test" + url, init));

beforeAll(async () => {
  process.env.APP_SECRET = "k".repeat(40); process.env.ADMIN_WALLETS = ADMIN;
  process.env.ESCROW_ADDRESS = "0x00000000000000000000000000000000000000e5"; process.env.SOCIAL_ADDRESS = "0x00000000000000000000000000000000000000f5";
  setDb(createClient({ url: ":memory:" })); await migrate();
  for (const [w, h, kind, owner] of [[OW, "owner", "human", null], [AG, "botty", "agent", OW], [ADA, "ada", "human", null]] as const)
    await db().execute({ sql: "INSERT INTO users(id,wallet,handle,display_name,kind,owner_wallet,created_at) VALUES(?,?,?,?,?,?,1)", args: [h, w, h, h, kind, owner] });
  ({ POST: reg } = await import("@/app/api/agents/register/route")); ({ GET: regFile } = await import("@/app/api/agents/[handle]/registration/route"));
  keys = await import("@/app/api/agent-keys/route"); ({ POST: hide } = await import("@/app/api/admin/hide/route")); ({ GET: feed } = await import("@/app/api/posts/route"));
  ({ GET: og } = await import("@/app/api/og/u/[handle]/route"));
});

describe("agents (ERC-8004), keys, admin, share card, keeper", () => {
  it("only the OWNER can register / key an agent; registration file is public", async () => {
    const mine = await run(reg, "/api/agents/register", { method: "POST", headers: cookie(OW), body: JSON.stringify({ handle: "botty" }) });
    expect(mine.status).toBe(200); const c = (await mine.json()).calls[0];
    expect(decodeFunctionData({ abi: identityAbi, data: c.data }).functionName).toBe("register");
    expect(c.to.toLowerCase()).toBe("0x8004A169FB4a3325136EB29fA0ceB6D2e539a432".toLowerCase());
    expect((await run(reg, "/api/agents/register", { method: "POST", headers: cookie(ADA), body: JSON.stringify({ handle: "botty" }) })).status).toBe(403);
    const f = await (await run(regFile, "/api/agents/botty/registration")).json(); expect(f.name).toBe("botty"); expect(f.agentWallet).toBe(AG);
    expect((await run(regFile, "/api/agents/ada/registration")).status).toBe(404);
  });
  it("key lifecycle: create (shown once), list never leaks secrets, revoke; humans/strangers refused", async () => {
    const body = (w: string) => JSON.stringify({ agentWallet: w, scopes: ["read", "tip"], perJobCap: 5_000_000, dailyCap: 10_000_000 });
    const made = await run(keys.POST, "/api/agent-keys", { method: "POST", headers: cookie(OW), body: body(AG) }); expect(made.status).toBe(201);
    const k = await made.json(); expect(k.key).toMatch(/^arc_/); expect(k.secret).toHaveLength(64);
    expect((await run(keys.POST, "/api/agent-keys", { method: "POST", headers: cookie(ADA), body: body(AG) })).status).toBe(403);
    expect((await run(keys.POST, "/api/agent-keys", { method: "POST", headers: cookie(OW), body: body(ADA) })).status).toBe(404);
    const list = JSON.stringify(await (await run(keys.GET, "/api/agent-keys", { headers: cookie(OW) })).json());
    expect(list).not.toContain(k.key); expect(list).not.toContain(k.secret);
    expect((await run(keys.DELETE, "/api/agent-keys", { method: "DELETE", headers: cookie(OW), body: JSON.stringify({ id: k.id }) })).status).toBe(200);
  });
  it("admin can hide a post, others cannot; hidden posts leave the feed", async () => {
    await db().execute({ sql: "INSERT INTO posts(id,author_wallet,feed,body,images,hash,created_at) VALUES('11111111-1111-4111-8111-111111111111',?, 'request','spam post here','[]','0x',1)", args: [ADA] });
    expect((await (await run(feed, "/api/posts?feed=request")).json()).items).toHaveLength(1);
    const b = JSON.stringify({ postId: "11111111-1111-4111-8111-111111111111", hidden: true });
    expect((await run(hide, "/api/admin/hide", { method: "POST", headers: cookie(ADA), body: b })).status).toBe(403);
    expect((await run(hide, "/api/admin/hide", { method: "POST", headers: cookie(ADMIN), body: b })).status).toBe(200);
    expect((await (await run(feed, "/api/posts?feed=request")).json()).items).toHaveLength(0);
  });
  it("share card renders a PNG", async () => {
    const r = await run(og, "/api/og/u/ada"); expect(r.status).toBe(200); expect(r.headers.get("content-type")).toContain("image/png");
    expect((await run(og, "/api/og/u/nobody")).status).toBe(404);
  }, 30000);
  it("keeper finds jobs past their timers from the event stream", async () => {
    await db().execute({ sql: "INSERT INTO jobs(id,chain_job_id,client,artisan,terms,terms_hash,status,created_at) VALUES('j1',9,?,?,'{}','0xh','Active',1)", args: [OW, ADA] });
    await applyEvent("escrow", { name: "JobStarted", args: { jobId: 9n, artisan: ADA } }, { block: 1, tx: "0xa", logIndex: 0, ts: 1000 });
    expect(await dueJobs(1000 + 3 * 86400 - 1)).toHaveLength(0);
    expect((await dueJobs(1000 + 3 * 86400 + 1))[0]).toMatchObject({ id: 9, why: "artisan silent 3 days" });
  });
});
