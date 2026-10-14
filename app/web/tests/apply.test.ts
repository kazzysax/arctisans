import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "@libsql/client";
import { setDb, migrate, db } from "@/db";
import { issueSession } from "@/lib/session";

// "Apply to my profile" / "Use as my profile photo": only the client of an agent job, only an agent's own message.
const CLIENT = "0x00000000000000000000000000000000000000c1", OTHER = "0x00000000000000000000000000000000000000d2", AGENT = "0x00000000000000000000000000000000000000a9", HUMAN = "0x00000000000000000000000000000000000000b3";
const cookie = (w: string) => ({ cookie: `arc_session=${issueSession(w)}`, "content-type": "application/json" });
let POST: any;
const call = (w: string, body: unknown, job = "j1") => POST(new Request(`http://x.test/api/jobs/${job}/apply`, { method: "POST", headers: cookie(w), body: JSON.stringify(body) }));

beforeAll(async () => {
  process.env.APP_SECRET = "y".repeat(40);
  setDb(createClient({ url: ":memory:" })); await migrate();
  ({ POST } = await import("@/app/api/jobs/[id]/apply/route"));
  const u = (id: string, w: string, handle: string, kind: string) => db().execute({ sql: "INSERT INTO users(id,wallet,handle,display_name,kind,title,bio,skills,created_at) VALUES(?,?,?,?,?,?,?,?,1)", args: [id, w, handle, handle, kind, "Old title", "Old bio", '["old"]', ] });
  await u("u1", CLIENT, "clara", "human"); await u("u2", OTHER, "olga", "human"); await u("u3", AGENT, "cvdoctor", "agent"); await u("u4", HUMAN, "hank", "human");
  const cols = (await db().execute("PRAGMA table_info(jobs)")).rows.map((r) => String(r.name));
  const need = ["id", "client", "artisan", "created_at"].filter((c) => cols.includes(c));
  const vals: Record<string, unknown> = { id: "j1", client: CLIENT, artisan: AGENT, created_at: 1 };
  const req = cols.filter((c) => ["terms_hash", "title", "amount", "status", "updated_at", "terms", "chain_job_id"].includes(c));
  const all = [...new Set([...need, ...req])];
  const fill: Record<string, unknown> = { ...vals, terms_hash: "0x" + "ab".repeat(32), title: "t", amount: 1, status: "Funded", updated_at: 1, terms: "{}", chain_job_id: null };
  await db().execute({ sql: `INSERT INTO jobs(${all.join(",")}) VALUES(${all.map(() => "?").join(",")})`, args: all.map((c) => fill[c] as any) });
  const m = (id: string, sender: string, body: string) => db().execute({ sql: "INSERT INTO job_messages(id,job_id,sender,body,created_at) VALUES(?,?,?,?,1)", args: [id, "j1", sender, body] });
  await m("m-agent", AGENT, "Here is your picture: https://abc123.public.blob.vercel-storage.com/agents/portrait/x.png");
  await m("m-agent-evil", AGENT, "Here: https://evil.example.com/x.png");
  await m("m-client", CLIENT, "https://abc123.public.blob.vercel-storage.com/agents/portrait/x.png");
});

describe("apply agent delivery", () => {
  it("needs sign-in", async () => {
    const r = await POST(new Request("http://x.test/api/jobs/j1/apply", { method: "POST", body: "{}" }));
    expect(r.status).toBe(401);
  });
  it("only the client of the job can use it", async () => {
    expect((await call(OTHER, { action: "photo", messageId: "m-agent" })).status).toBe(404);
    expect((await call(AGENT, { action: "photo", messageId: "m-agent" })).status).toBe(404);
  });
  it("a message the client wrote themselves is refused", async () => {
    expect((await call(CLIENT, { action: "photo", messageId: "m-client" })).status).toBe(404);
  });
  it("a picture link not on our storage is refused", async () => {
    expect((await call(CLIENT, { action: "photo", messageId: "m-agent-evil" })).status).toBe(400);
  });
  it("saving needs real changes and the user's own job", async () => {
    expect((await call(CLIENT, { action: "save", proposal: {} })).status).toBe(400);
    expect((await call(OTHER, { action: "save", proposal: { title: "Hacked" } })).status).toBe(404);
    expect((await call(CLIENT, { action: "save", proposal: { title: "x".repeat(81) } })).status).toBe(400);
  });
  it("saves title, bio and skills for the client only", async () => {
    const r = await call(CLIENT, { action: "save", proposal: { title: "Brand designer", bio: "I design brands.", skills: ["Logo", "Branding"] } });
    expect(r.status).toBe(200);
    const me = (await db().execute({ sql: "SELECT title, bio, skills FROM users WHERE wallet=?", args: [CLIENT] })).rows[0];
    expect(me.title).toBe("Brand designer"); expect(me.bio).toBe("I design brands."); expect(JSON.parse(String(me.skills))).toEqual(["logo", "branding"]);
    const other = (await db().execute({ sql: "SELECT title FROM users WHERE wallet=?", args: [OTHER] })).rows[0];
    expect(other.title).toBe("Old title");
  });
  it("a skipped field keeps its old value", async () => {
    await call(CLIENT, { action: "save", proposal: { bio: "New bio only" } });
    const me = (await db().execute({ sql: "SELECT title, bio FROM users WHERE wallet=?", args: [CLIENT] })).rows[0];
    expect(me.title).toBe("Brand designer"); expect(me.bio).toBe("New bio only");
  });
});
