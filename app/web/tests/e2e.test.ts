import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "@libsql/client";
import sharp from "sharp";
import { decodeFunctionData } from "viem";
import { setDb, migrate, db } from "@/db";
import { issueSession } from "@/lib/session";
import { arctisanEscrowAbi, arctisanSocialAbi } from "@/lib/abi";
import { applyEvent } from "@/lib/indexer";
import { getReputation } from "@/lib/queries";

const ADA = "0x00000000000000000000000000000000000000a1", BOB = "0x00000000000000000000000000000000000000b2", AG = "0x00000000000000000000000000000000000000a6";
const cookie = (w: string) => ({ cookie: `arc_session=${issueSession(w)}` });
let PUT: any, GETp: any, POSTposts: any, GETposts: any, tipPOST: any, jobsPOST: any, jobPOST: any, uGET: any, followPOST: any, likePOST: any, searchGET: any, notifGET: any;
const call = (h: any, url: string, init: RequestInit = {}) => h(new Request("http://x.test" + url, init));
const png = () => sharp({ create: { width: 1600, height: 1200, channels: 3, background: "#336" } }).png().toBuffer();

beforeAll(async () => {
  process.env.APP_SECRET = "y".repeat(40);
  process.env.ESCROW_ADDRESS = "0x00000000000000000000000000000000000000e5";
  process.env.SOCIAL_ADDRESS = "0x00000000000000000000000000000000000000f5";
  process.env.UPLOAD_DIR = require("node:os").tmpdir() + "/arc-e2e";
  setDb(createClient({ url: ":memory:" })); await migrate();
  ({ PUT, GET: GETp } = await import("@/app/api/profile/route"));
  ({ POST: POSTposts, GET: GETposts } = await import("@/app/api/posts/route"));
  ({ POST: tipPOST } = await import("@/app/api/tip/route"));
  ({ POST: jobsPOST } = await import("@/app/api/jobs/route"));
  ({ POST: jobPOST } = await import("@/app/api/jobs/[id]/route"));
  ({ GET: uGET } = await import("@/app/api/u/[handle]/route"));
  ({ POST: followPOST } = await import("@/app/api/follow/route"));
  ({ POST: likePOST } = await import("@/app/api/like/route"));
  ({ GET: searchGET } = await import("@/app/api/search/route"));
  ({ GET: notifGET } = await import("@/app/api/notifications/route"));
});

const prof = (w: string, handle: string, extra = {}) => call(PUT, "/api/profile", { method: "PUT", headers: { ...cookie(w), "content-type": "application/json" }, body: JSON.stringify({ handle, displayName: handle.toUpperCase(), title: "Designer", bio: "hi", skills: ["Logo", "Branding"], links: [{ label: "LinkedIn", url: "https://linkedin.com/in/x" }], city: "Lagos", ...extra }) });

describe("API end to end", () => {
  it("needs sign-in", async () => { expect((await call(GETp, "/api/profile")).status).toBe(401); });
  it("creates profiles (CV), handle uniqueness, agent needs owner, rejects javascript: links", async () => {
    expect((await prof(ADA, "ada")).status).toBe(200);
    expect((await prof(BOB, "bob")).status).toBe(200);
    expect((await prof(BOB, "ada")).status).toBe(409);
    expect((await prof(AG, "agentx", { kind: "agent" })).status).toBe(400);
    expect((await prof(AG, "agentx", { kind: "agent", ownerWallet: BOB })).status).toBe(403); // a new agent can only be registered by its owner
    await db().execute({ sql: "INSERT INTO users(id,wallet,handle,display_name,kind,owner_wallet,created_at) VALUES(?,?,?,?,?,?,1)", args: ["ag1", AG, "agentx", "AGENTX", "agent", BOB] });
    expect((await prof(ADA, "ada", { links: [{ label: "x", url: "javascript:alert(1)" }] })).status).toBe(400);
  });
  it("work post: 3 pictures max, compressed; 4 refused; no pictures refused; request text-only", async () => {
    const mk = async (n: number, feed = "work") => { const f = new FormData(); f.set("feed", feed); f.set("body", "My latest brand work"); f.set("skill", "Logo"); for (let i = 0; i < n; i++) f.append("images", new File([new Uint8Array(await png())], "a.png", { type: "image/png" })); return f; };
    const ok3 = await call(POSTposts, "/api/posts", { method: "POST", headers: cookie(ADA), body: await mk(3) });
    expect(ok3.status).toBe(201); const j = await ok3.json(); expect(j.anchor).toHaveLength(1);
    expect((await call(POSTposts, "/api/posts", { method: "POST", headers: cookie(ADA), body: await mk(4) })).status).toBe(400);
    expect((await call(POSTposts, "/api/posts", { method: "POST", headers: cookie(ADA), body: await mk(0) })).status).toBe(400);
    const bad = new FormData(); bad.set("feed", "work"); bad.append("images", new File(["not an image"], "a.png"));
    expect((await call(POSTposts, "/api/posts", { method: "POST", headers: cookie(ADA), body: bad })).status).toBe(400);
    const req = new FormData(); req.set("feed", "request"); req.set("body", "Need a logo for my bakery"); req.set("budget", "30000000");
    expect((await call(POSTposts, "/api/posts", { method: "POST", headers: cookie(BOB), body: req })).status).toBe(201);
    const withImg = await mk(1, "request");
    expect((await call(POSTposts, "/api/posts", { method: "POST", headers: cookie(BOB), body: withImg })).status).toBe(400);
  });
  it("unregistered wallets cannot post", async () => {
    const f = new FormData(); f.set("feed", "request"); f.set("body", "hello there friend");
    expect((await call(POSTposts, "/api/posts", { method: "POST", headers: cookie("0x00000000000000000000000000000000000000d4"), body: f })).status).toBe(403);
  });
  it("two feeds, filters, follow, like, search", async () => {
    const work = await (await call(GETposts, "/api/posts?feed=work")).json(); expect(work.items).toHaveLength(1); expect(work.items[0].images).toHaveLength(3);
    const req = await (await call(GETposts, "/api/posts?feed=request")).json(); expect(req.items).toHaveLength(1);
    expect((await (await call(GETposts, "/api/posts?feed=work&skill=logo")).json()).items).toHaveLength(1);
    expect((await (await call(GETposts, "/api/posts?feed=work&skill=writing")).json()).items).toHaveLength(0);
    expect((await (await call(GETposts, "/api/posts?feed=work&kind=agent")).json()).items).toHaveLength(0);
    expect((await call(GETposts, "/api/posts?feed=work&following=1")).status).toBe(401);
    expect((await call(followPOST, "/api/follow", { method: "POST", headers: { ...cookie(BOB), "content-type": "application/json" }, body: JSON.stringify({ wallet: ADA, follow: true }) })).status).toBe(200);
    expect((await call(followPOST, "/api/follow", { method: "POST", headers: { ...cookie(BOB), "content-type": "application/json" }, body: JSON.stringify({ wallet: BOB, follow: true }) })).status).toBe(400);
    expect((await (await call(GETposts, "/api/posts?feed=work&following=1", { headers: cookie(BOB) })).json()).items).toHaveLength(1);
    expect((await (await call(GETposts, "/api/posts?feed=work&following=1", { headers: cookie(ADA) })).json()).items).toHaveLength(0);
    const id = work.items[0].id;
    const l = await (await call(likePOST, "/api/like", { method: "POST", headers: { ...cookie(BOB), "content-type": "application/json" }, body: JSON.stringify({ postId: id, like: true }) })).json(); expect(l.likes).toBe(1);
    const s = await (await call(searchGET, "/api/search?q=ada")).json(); expect(s.items.map((x: any) => x.handle)).toContain("ada");
    expect((await (await call(searchGET, "/api/search?kind=agent")).json()).items).toHaveLength(1);
  });
  it("tip: builds approve+tip, min $0.50, no self-tip, post must belong to artisan", async () => {
    const post = (await (await call(GETposts, "/api/posts?feed=work")).json()).items[0];
    const r = await call(tipPOST, "/api/tip", { method: "POST", headers: { ...cookie(BOB), "content-type": "application/json" }, body: JSON.stringify({ to: ADA, amount: 2_000_000, postId: post.id }) });
    expect(r.status).toBe(200); const j = await r.json(); expect(j.calls).toHaveLength(2);
    expect(decodeFunctionData({ abi: arctisanSocialAbi, data: j.calls[1].data }).functionName).toBe("tip");
    const bad = (a: any) => call(tipPOST, "/api/tip", { method: "POST", headers: { ...cookie(BOB), "content-type": "application/json" }, body: JSON.stringify(a) });
    expect((await bad({ to: ADA, amount: 100 })).status).toBe(400);
    expect((await bad({ to: BOB, amount: 2_000_000 })).status).toBe(400);
    expect((await bad({ to: AG, amount: 2_000_000, postId: post.id })).status).toBe(400);
  });
  it("agreement -> propose; indexing events drives status, notifications, reputation", async () => {
    const dl = Math.floor(Date.now() / 1000) + 7 * 86400;
    const r = await call(jobsPOST, "/api/jobs", { method: "POST", headers: { ...cookie(BOB), "content-type": "application/json" }, body: JSON.stringify({ counterparty: ADA, iAm: "client", title: "Bakery logo", deliverables: ["3 concepts"], doneMeans: "PNG+SVG delivered", skills: ["logo"], deadline: dl, total: 30_000_000 }) });
    expect(r.status).toBe(201); const j = await r.json();
    expect(j.total).toBe(30_000_000); expect(j.terms.upfront).toBe(0); expect(j.terms.milestones).toEqual([30_000_000]); // New artisan: paid on approval
    // asking a New artisan for upfront is refused (the escrow would refuse it too)
    const up = await call(jobsPOST, "/api/jobs", { method: "POST", headers: { ...cookie(BOB), "content-type": "application/json" }, body: JSON.stringify({ counterparty: ADA, iAm: "client", title: "Bakery logo", deliverables: ["3 concepts"], doneMeans: "PNG+SVG delivered", deadline: dl, upfront: 10_000_000, milestones: [20_000_000] }) });
    expect(up.status).toBe(400); expect((await up.json()).error).toMatch(/Trusted/);
    expect(decodeFunctionData({ abi: arctisanEscrowAbi, data: j.calls[0].data }).args?.[2]).toBe(j.hash);
    // over $100 refused
    expect((await call(jobsPOST, "/api/jobs", { method: "POST", headers: { ...cookie(BOB), "content-type": "application/json" }, body: JSON.stringify({ counterparty: ADA, iAm: "client", title: "Too big", deliverables: ["x"], doneMeans: "done done", deadline: dl, total: 100_000_001 }) })).status).toBe(400);
    // before it exists onchain, actions wait
    expect((await call(jobPOST, "/api/jobs/" + j.id, { method: "POST", headers: { ...cookie(BOB), "content-type": "application/json" }, body: JSON.stringify({ action: "fund" }) })).status).toBe(409);
    // simulate the chain emitting events, in order
    let n = 0; const meta = () => ({ block: 100 + n, tx: "0x" + String(n).padStart(64, "0"), logIndex: n++, ts: 1_900_000_000 + n });
    await applyEvent("escrow", { name: "JobProposed", args: { jobId: 1n, client: BOB, artisan: ADA, proposer: BOB, termsHash: j.hash } }, meta());
    expect((await (await call(jobPOST, "/api/jobs/" + j.id, { method: "POST", headers: { ...cookie(ADA), "content-type": "application/json" }, body: JSON.stringify({ action: "fund" }) })).status)).toBe(403); // only client funds
    const fund = await (await call(jobPOST, "/api/jobs/" + j.id, { method: "POST", headers: { ...cookie(BOB), "content-type": "application/json" }, body: JSON.stringify({ action: "fund" }) })).json();
    expect(fund.calls).toHaveLength(2);
    expect((await call(jobPOST, "/api/jobs/" + j.id, { method: "POST", headers: { ...cookie("0x00000000000000000000000000000000000000d4"), "content-type": "application/json" }, body: JSON.stringify({ action: "cancel" }) })).status).toBe(404); // stranger
    for (const [name, args] of [["TermsAgreed", { jobId: 1n, by: ADA }], ["JobFunded", { jobId: 1n, client: BOB, amount: 30000000n }], ["JobStarted", { jobId: 1n, artisan: ADA }], ["Delivered", { jobId: 1n, artisan: ADA, milestone: 0, onTime: true }]] as const)
      await applyEvent("escrow", { name, args: args as any }, meta());
    const dup = meta(); await applyEvent("escrow", { name: "Released", args: { jobId: 1n, to: ADA, milestone: 0, net: 30000000n, fee: 0n } }, dup);
    expect(await applyEvent("escrow", { name: "Released", args: { jobId: 1n, to: ADA, milestone: 0, net: 30000000n, fee: 0n } }, dup)).toBe(false); // replay is a no-op
    await applyEvent("escrow", { name: "JobClosed", args: { jobId: 1n, client: BOB, artisan: ADA, outcome: 7, paidToArtisan: 30000000n, refundedToClient: 0n, onTime: true } }, meta());
    await applyEvent("social", { name: "Reviewed", args: { jobId: 1n, reviewer: BOB, subject: ADA, rating: 5, reviewHash: "0x" + "ab".repeat(32) } }, meta());
    await applyEvent("social", { name: "Tipped", args: { from: BOB, to: ADA, postHash: "0x" + "11".repeat(32), amount: 2000000n } }, meta());
    const pub = await (await call(uGET, "/api/u/ada")).json();
    expect(pub.profile.handle).toBe("ada");
    expect(pub.reputation).toMatchObject({ completed: 1, earned: 30_000_000, ratingAvg: 5, ratingCount: 1, tipsReceived: 2_000_000, uniqueClients: 1, onTimeRate: 1, skills: { logo: 1 } });
    expect(pub.level).toMatchObject({ name: "New", upfrontPct: 0 });
    expect(pub.badges.find((b: { id: string }) => b.id === "first-job").earned).toBe(true);
    expect(pub.badges).toHaveLength(12);
    const mine = await (await call((await import("@/app/api/jobs/route")).GET, "/api/jobs", { headers: cookie(ADA) })).json();
    expect(mine.items[0].status).toBe("Completed");
    const notifs = await (await call(notifGET, "/api/notifications", { headers: cookie(ADA) })).json();
    expect(notifs.items.map((x: any) => x.kind)).toEqual(expect.arrayContaining(["job_funded", "payment_released", "tip", "review"]));
    expect((await getReputation(BOB)).spent).toBe(30_000_000);
  });
});
