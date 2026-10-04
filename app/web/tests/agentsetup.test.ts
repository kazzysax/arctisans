import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "@libsql/client";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { setDb, migrate, db } from "@/db";
import { createKey, signRequest } from "@/lib/agentauth";
import { registrationMessage } from "@/lib/agentreg";
import { createHmac } from "node:crypto";

const SECRET = "z".repeat(40);
const OWNER = "0x00000000000000000000000000000000000000c1", HUMAN = "0x00000000000000000000000000000000000000a1";
const cookie = (w: string) => { const body = Buffer.from(JSON.stringify({ w, exp: Date.now() + 86400000 })).toString("base64url"); return `arc_session=${body}.${createHmac("sha256", SECRET).update(body).digest("base64url")}`; };
let create: any, mine: any, list: any, msgs: any;
const agent = privateKeyToAccount(generatePrivateKey()), thief = privateKeyToAccount(generatePrivateKey());
const post = (path: string, body: object, w = OWNER) => new Request("http://x.test" + path, { method: "POST", body: JSON.stringify(body), headers: { cookie: cookie(w), "content-type": "application/json" } });

beforeAll(async () => {
  process.env.APP_SECRET = SECRET;
  process.env.ESCROW_ADDRESS = "0x00000000000000000000000000000000000000e5"; process.env.SOCIAL_ADDRESS = "0x00000000000000000000000000000000000000f5";
  setDb(createClient({ url: ":memory:" })); await migrate();
  for (const [i, w, h] of [["1", OWNER, "owner1"], ["2", HUMAN, "ada"]]) await db().execute({ sql: "INSERT INTO users(id,wallet,handle,display_name,created_at) VALUES(?,?,?,?,1)", args: [i, w, h, h] });
  ({ POST: create } = await import("@/app/api/agents/create/route")); ({ GET: mine } = await import("@/app/api/agents/mine/route"));
  ({ GET: list } = await import("@/app/api/v1/jobs/route"));
  if (!list) throw new Error("GET missing on /api/v1/jobs"); msgs = await import("@/app/api/v1/jobs/[id]/messages/route");
});
const reg = async (handle: string, acct = agent, owner = OWNER) => ({ handle, displayName: "Scribe", craft: "writing", agentWallet: acct.address, signature: await acct.signMessage({ message: registrationMessage(handle, acct.address, owner) }) });

describe("agent sign-up", () => {
  it("owner registers an agent that proves it holds its key", async () => {
    const r = await create(post("/api/agents/create", await reg("scribe"))); expect(r.status).toBe(201);
    const row = (await db().execute("SELECT kind, owner_wallet FROM users WHERE handle='scribe'")).rows[0];
    expect(String(row.kind)).toBe("agent"); expect(String(row.owner_wallet)).toBe(OWNER);
  });
  it("a signature from another wallet is refused (cannot register someone else's address)", async () => {
    const body = { ...(await reg("stolen")), agentWallet: thief.address };
    expect((await create(post("/api/agents/create", body))).status).toBe(400);
  });
  it("a signature for a different owner or handle is refused", async () => {
    expect((await create(post("/api/agents/create", await reg("other", agent, HUMAN)))).status).toBe(400);
  });
  it("duplicate wallet or handle refused; signed-out refused", async () => {
    expect((await create(post("/api/agents/create", await reg("scribe")))).status).toBe(409);
    expect((await create(new Request("http://x.test/api/agents/create", { method: "POST", body: "{}" }))).status).toBe(401);
  });
  it("the owner sees the agent in their console; others do not", async () => {
    expect((await (await mine(new Request("http://x.test/api/agents/mine", { headers: { cookie: cookie(OWNER) } }))).json()).items).toHaveLength(1);
    expect((await (await mine(new Request("http://x.test/api/agents/mine", { headers: { cookie: cookie(HUMAN) } }))).json()).items).toHaveLength(0);
  });
});

describe("agent inbox and negotiation", () => {
  it("agent sees only its own jobs and can message the other party", async () => {
    const k = await createKey({ agentWallet: agent.address.toLowerCase(), ownerWallet: OWNER, scopes: ["read", "agree"], perJobCap: 20e6, dailyCap: 25e6 });
    const terms = JSON.stringify({ version: 1, client: HUMAN, artisan: agent.address, title: "Thread", description: "", deliverables: ["x"], doneMeans: "Thread delivered", skills: [], revisions: 1, deadline: 9999999999, upfront: 0, milestones: [10e6], deadlockRule: "Split5050" });
    await db().execute({ sql: "INSERT INTO jobs(id,client,artisan,terms,terms_hash,skills,status,created_at) VALUES('j1',?,?,?,'h1','[]','Draft',1)", args: [HUMAN, agent.address.toLowerCase(), terms] });
    await db().execute({ sql: "INSERT INTO jobs(id,client,artisan,terms,terms_hash,skills,status,created_at) VALUES('j2',?,?,?,'h2','[]','Draft',1)", args: [HUMAN, OWNER, terms] });
    const L = await list(new Request("http://x.test/api/v1/jobs", { headers: { authorization: `Bearer ${k.key}` } }));
    const J = await L.json(); if (!J.items) throw new Error(`list returned ${L.status}: ${JSON.stringify(J)}`);
    const items = J.items; expect(items.map((i: any) => i.id)).toEqual(["j1"]); expect(items[0].role).toBe("artisan");
    const path = "/api/v1/jobs/j1/messages", raw = JSON.stringify({ body: "Can you do $12?" });
    const sent = await msgs.POST(new Request("http://x.test" + path, { method: "POST", body: raw, headers: { authorization: `Bearer ${k.key}`, ...signRequest(k.secret, "POST", path, raw) } }));
    expect(sent.status).toBe(201);
    expect((await (await msgs.GET(new Request("http://x.test" + path, { headers: { authorization: `Bearer ${k.key}` } }))).json()).items[0].body).toBe("Can you do $12?");
    const other = "/api/v1/jobs/j2/messages"; // a job the agent is not part of
    expect((await msgs.GET(new Request("http://x.test" + other, { headers: { authorization: `Bearer ${k.key}` } }))).status).toBe(404);
  });
});
