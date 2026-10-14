import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "@libsql/client";
import { setDb, migrate, db } from "@/db";
import { issueSession } from "@/lib/session";
import { looksLikeToken, cleanToken } from "@/lib/dreams/studio";

const ME = "0x00000000000000000000000000000000000000c1", OTHER = "0x00000000000000000000000000000000000000d2";
const cookie = (w: string) => ({ cookie: `arc_session=${issueSession(w)}`, "content-type": "application/json" });
let POST: any, GET: any;
const call = (h: any, w: string | null, id: string, body?: unknown) => h(new Request(`http://x.test/api/dreams/${id}/studio`, { method: body ? "POST" : "GET", headers: w ? cookie(w) : { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined }));
const GOOD = "origin_pat_" + "a".repeat(40);

beforeAll(async () => {
  process.env.APP_SECRET = "y".repeat(40);
  setDb(createClient({ url: ":memory:" })); await migrate();
  ({ POST, GET } = await import("@/app/api/dreams/[id]/studio/route"));
  const ins = (id: string, w: string, status: string, sheet: string | null, app: string | null) => db().execute({ sql: "INSERT INTO dreams(id,wallet,idea,status,sheet,studio_app,studio_thread,created_at,updated_at) VALUES(?,?,?,?,?,?,?,1,1)", args: [id, w, "a burger ordering app idea", status, sheet, app, app ? "th1" : null] });
  await ins("d-new", ME, "asking", null, null);
  await ins("d-sent", ME, "ready", "SHEET", "app123");
});

describe("Arc Studio hand-off", () => {
  it("token shape: only origin_pat_ tokens pass", () => {
    expect(looksLikeToken(GOOD)).toBe(true);
    expect(looksLikeToken("hello")).toBe(false);
    expect(looksLikeToken("origin_pat_")).toBe(false);
    expect(looksLikeToken(GOOD + " rm -rf")).toBe(false);
    expect(cleanToken("  " + GOOD + "\n")).toBe(GOOD);
  });
  it("needs sign-in", async () => {
    expect((await call(POST, null, "d-new", { action: "send", token: GOOD })).status).toBe(401);
  });
  it("only the owner of the dream", async () => {
    expect((await call(POST, OTHER, "d-new", { action: "send", token: GOOD })).status).toBe(404);
    expect((await call(GET, OTHER, "d-new")).status).toBe(404);
  });
  it("a malformed token is refused before anything is sent", async () => {
    expect((await call(POST, ME, "d-new", { action: "send", token: "not-a-token" })).status).toBe(400);
  });
  it("cannot send a dream whose sheet is not ready", async () => {
    expect((await call(POST, ME, "d-new", { action: "send", token: GOOD })).status).toBe(409);
  });
  it("a dream already sent never starts a second build", async () => {
    const r = await call(POST, ME, "d-sent", { action: "send", token: GOOD });
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j.already).toBe(true); expect(j.webUrl).toContain("app123");
  });
  it("the token is never saved", async () => {
    const cols = (await db().execute("SELECT * FROM dreams")).rows.map((r) => JSON.stringify(r)).join("");
    expect(cols).not.toContain(GOOD);
  });
  it("status shows the link once sent", async () => {
    const j = await (await call(GET, ME, "d-sent")).json();
    expect(j.sent).toBe(true); expect(j.webUrl).toContain("app123");
  });
});
