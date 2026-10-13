import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { createClient } from "@libsql/client";
import { setDb, migrate, db } from "@/db";
import { buildSheet, extractJson, cleanIdea, looksLikeQuestion, SHEET_MAX, BLOCKED, PlanCard, ResearchCard, QuestionSet } from "@/lib/dreams/core";

const plan = { name: "Tip Jar", oneLiner: "Tip a creator in USDC", vibe: "warm and playful", audience: "fans and creators", screens: ["Home", "Tip"], rules: ["Only the creator withdraws", "Tips are final"], mustNot: ["Funds stuck"] };
const research = { use: [{ piece: "Arc USDC", why: "gas and payment" }], skills: ["pyth" as const], risks: ["blocklisted creator"], similar: [], followups: [{ id: "f1", text: "Fee?", options: [{ id: "a", label: "None" }, { id: "b", label: "1%" }] }] };

describe("dreams core", () => {
  it("parses JSON out of chatter and fences", () => {
    expect(extractJson('Sure!\n```json\n{"a":1}\n```\nbye')).toEqual({ a: 1 });
    expect(() => extractJson("no json here")).toThrow();
  });
  it("cleans the idea: control chars, spaces, length", () => {
    expect(cleanIdea("a\u0000b\n\n  c")).toBe("a b c");
    expect(cleanIdea("x".repeat(900)).length).toBe(280);
  });
  it("validates cards and rejects bad shapes", () => {
    expect(PlanCard.safeParse(plan).success).toBe(true);
    expect(PlanCard.safeParse({ ...plan, screens: ["one"] }).success).toBe(false);
    expect(ResearchCard.safeParse({ ...research, skills: ["uniswap"] }).success).toBe(false); // mainnet-only skill is not allowed
    const ok = QuestionSet.safeParse({ questions: Array(3).fill({ id: "Bad Id!", text: "t".repeat(300), options: [{ id: "A", label: "a" }, { id: "B", label: "b" }] }) });
    expect(ok.success).toBe(true); // sloppy ids are made safe and long text is trimmed, not rejected
    if (ok.success) { expect(ok.data.questions[0].id).toBe("bad_id"); expect(ok.data.questions[0].text.length).toBe(140); expect(ok.data.questions[0].options[0].id).toBe("a"); }
    expect(QuestionSet.safeParse({ questions: [{ id: "x", text: "x", options: [{ id: "a", label: "a" }, { id: "a", label: "b" }] }] }).success).toBe(false); // duplicate option ids
    expect(QuestionSet.safeParse({ questions: [] }).success).toBe(false);
    const em = QuestionSet.safeParse({ questions: Array(3).fill({ id: "x", text: "What's the vibe? \u{1F3E1}\u2728", options: [{ id: "a", label: "Cozy \u{1F9D1}\u200D\u{1F91D}\u200D\u{1F9D1}" }, { id: "b", label: "Plain" }] }) });
    expect(em.success && em.data.questions[0].text).toBe("What's the vibe?"); // no emojis reach the screen
    expect(em.success && em.data.questions[0].options[0].label).toBe("Cozy");
  });
  it("builds a sheet under Studio's 10,000 character cap, even with maxed-out cards", () => {
    const fat = "w".repeat(140);
    const bigPlan = { ...plan, name: "N".repeat(40), oneLiner: fat, vibe: "v".repeat(200), audience: "a".repeat(160), screens: Array(6).fill("s".repeat(80)), rules: Array(6).fill(fat), mustNot: Array(4).fill("m".repeat(120)) };
    const bigRes = { ...research, use: Array(6).fill({ piece: "p".repeat(60), why: fat }), risks: Array(5).fill(fat), similar: Array(3).fill("s".repeat(100)) };
    const answers = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`q${i}`, { label: "l".repeat(200) }]));
    const s = buildSheet("i".repeat(280), bigPlan, bigRes, answers);
    expect(s.text.length).toBeLessThanOrEqual(SHEET_MAX);
    expect(SHEET_MAX).toBeLessThan(10_000);
  });
  it("sheet carries the idea, rules and skills", () => {
    const s = buildSheet("A tip jar", plan, research, { q: { label: "Vibe -> warm" } });
    expect(s.text).toContain("Only the creator withdraws");
    expect(s.text).toContain("Vibe -> warm");
    expect(s.skills).toEqual(["pyth"]);
  });
  it("blocks scam ideas but lets normal ones through", () => {
    for (const bad of ["a ponzi that pays early users", "drain wallets of people who connect", "a mixer to launder funds", "fake airdrop claim page"]) expect(BLOCKED.test(bad)).toBe(true);
    for (const good of ["a tip jar for creators", "split rent between roommates", "escrow for freelance design jobs", "a loyalty card for coffee shops"]) expect(BLOCKED.test(good)).toBe(false);
  });
  it("spots a question hidden in a completed turn", () => {
    expect(looksLikeQuestion("Which chain do you want?", 0, 0)).toBe(true);
    expect(looksLikeQuestion("Done. Everything is live.", 5, 1)).toBe(false);
    expect(looksLikeQuestion("Which chain?", 3, 0)).toBe(false);
    expect(looksLikeQuestion("", 0, 0)).toBe(false);
  });
});

const calls: string[] = [];
vi.mock("@/lib/native/llm", () => ({
  chat: vi.fn(async (system: string) => {
    calls.push(system.slice(0, 20));
    if (system.includes("Mochi") && system.includes("Ask 4")) return JSON.stringify({ questions: ["vibe", "who", "do", "pay"].map((id) => ({ id, text: `Q ${id}`, options: [{ id: "a", label: "A" }, { id: "b", label: "B" }] })) });
    if (system.includes("Plan Card")) return "```json\n" + JSON.stringify(plan) + "\n```";
    return JSON.stringify(research);
  }),
}));
vi.mock("@/lib/indexer", () => ({ client: () => ({ getTransactionReceipt: async () => null }) }));

describe("dream flow", () => {
  beforeAll(async () => { setDb(createClient({ url: ":memory:" })); await migrate(); });
  beforeEach(async () => { await db().execute("DELETE FROM dreams"); calls.length = 0; });
  const mk = async (status = "paid") => {
    await db().execute({ sql: "INSERT INTO dreams(id,wallet,idea,status,created_at,updated_at) VALUES('d1','0xabc','a tip jar for creators',?,1,1)", args: [status] });
    const { getDream } = await import("@/lib/dreams/store"); return (await getDream("d1", "0xabc"))!;
  };
  it("runs paid -> asking -> researched -> ready with the right call count", async () => {
    const { advance, getDream, view } = await import("@/lib/dreams/store");
    let d = await advance(await mk(), undefined); expect(d.status).toBe("asking"); expect(d.questions).toHaveLength(4);
    const ans = Object.fromEntries(d.questions.map((q) => [q.id, { optionId: "a", label: "" }]));
    d = await advance((await getDream("d1", "0xabc"))!, ans); expect(d.status).toBe("researched"); expect(d.calls).toBe(3);
    expect(view(d).followups).toHaveLength(1);
    d = await advance((await getDream("d1", "0xabc"))!, { f1: { optionId: "b", label: "" } }); expect(d.status).toBe("ready");
    expect(d.sheet).toContain("Tip Jar"); expect(d.sheet!.length).toBeLessThanOrEqual(SHEET_MAX);
    expect(calls).toHaveLength(3);
  });
  it("refuses unpaid dreams, unanswered questions and made-up options", async () => {
    const { advance, getDream } = await import("@/lib/dreams/store");
    await expect(advance(await mk("new"))).rejects.toThrow(/paid/);
    await db().execute("DELETE FROM dreams");
    const d = await advance(await mk(), undefined);
    await expect(advance(d, {})).rejects.toThrow(/answer every/);
    const bad = Object.fromEntries(d.questions.map((q) => [q.id, { optionId: "zzz", label: "" }]));
    await expect(advance((await getDream("d1", "0xabc"))!, bad)).rejects.toThrow(/listed options/);
  });
  it("caps model calls per dream", async () => {
    const { advance } = await import("@/lib/dreams/store");
    await db().execute({ sql: "INSERT INTO dreams(id,wallet,idea,status,calls,created_at,updated_at) VALUES('d2','0xabc','x idea long enough','paid',8,1,1)" });
    const { getDream } = await import("@/lib/dreams/store");
    await expect(advance((await getDream("d2", "0xabc"))!)).rejects.toThrow(/Over the limit/);
  });
  it("one dream belongs to one wallet", async () => {
    const { getDream } = await import("@/lib/dreams/store"); await mk();
    expect(await getDream("d1", "0xother")).toBeNull();
  });
  it("one payment receipt cannot pay for two dreams", async () => {
    const { markPaid } = await import("@/lib/dreams/store");
    await db().execute("INSERT INTO dreams(id,wallet,idea,created_at,updated_at) VALUES('a','0xabc','first idea here ok',1,1),('b','0xabc','second idea here ok',1,1)");
    expect(await markPaid("a", "0xabc", "0xAA")).toBe("ok");
    expect(await markPaid("b", "0xabc", "0xaa")).toBe("used");
  });
});
