import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { createClient } from "@libsql/client";
import { setDb, migrate, db } from "@/db";
import { buildSheet, extractJson, cleanIdea, looksLikeQuestion, checkAnswer, SHEET_MAX, BLOCKED, PlanCard, ResearchCard, QuestionSet, type Question } from "@/lib/dreams/core";

const opts = [{ id: "a", label: "Option A" }, { id: "b", label: "Option B" }, { id: "c", label: "Option C" }];
const plan = {
  name: "Tip Jar", oneLiner: "Tip a creator in USDC", audience: "fans and creators", roles: ["Fan: tips", "Creator: withdraws"],
  mustHave: ["Send a tip", "Creator withdraws", "Leaderboard"], later: ["Recurring tips"], acceptance: ["A fan can tip", "Only the creator withdraws", "Tips show on the board"],
  vibe: "warm and playful", screens: ["Home", "Tip"], rules: ["Only the creator withdraws", "Tips are final"], mustNot: ["Funds stuck"],
};
const research = {
  stack: [{ layer: "contract", choice: "Foundry", why: "Studio uses it" }, { layer: "app", choice: "Vite", why: "Studio uses it" }, { layer: "auth", choice: "Circle wallets", why: "no seed phrase" }],
  architecture: "The app reads and writes the deployed contract.", dataModel: ["Tips: in the contract", "Names: in the contract"],
  integrations: [], arcPieces: [{ piece: "Arc USDC", why: "gas and payment" }], studioCovers: ["Contract and app"], outsideStudio: ["Hosting"],
  milestones: ["Contract", "App", "Polish"], risks: ["Blocklisted creator", "Failed tips"], similar: [], skills: ["pyth" as const], sources: ["https://docs.arc.io/"],
  followups: [{ id: "f1", section: "specs" as const, text: "Fee?", multi: false, options: [{ id: "a", label: "None" }, { id: "b", label: "1%" }] }],
};
const nine = (): Question[] => ["specs", "specs", "specs", "features", "features", "features", "design", "design", "design"].map((section, i) => ({ id: `q${i}`, section: section as Question["section"], text: `Q ${i}`, multi: i === 4, options: opts }));

describe("dreams core", () => {
  it("parses JSON out of chatter and fences", () => {
    expect(extractJson('Sure!\n```json\n{"a":1}\n```\nbye')).toEqual({ a: 1 });
    expect(() => extractJson("no json here")).toThrow();
  });
  it("cleans the idea: control chars, spaces, length", () => {
    expect(cleanIdea("a\u0000b\n\n  c")).toBe("a b c");
    expect(cleanIdea("x".repeat(900)).length).toBe(280);
  });
  it("validates the plan and research cards", () => {
    expect(PlanCard.safeParse(plan).success).toBe(true);
    expect(PlanCard.safeParse({ ...plan, screens: ["one"] }).success).toBe(false);
    expect(PlanCard.safeParse({ ...plan, acceptance: ["only one"] }).success).toBe(false);
    expect(ResearchCard.safeParse(research).success).toBe(true);
    const r = ResearchCard.safeParse({ ...research, skills: ["uniswap", "pyth"] }); // a mainnet-only skill is dropped, not trusted
    expect(r.success && r.data.skills).toEqual(["pyth"]);
  });
  it("is tolerant of long lists and odd shapes from a model, but not of missing structure", () => {
    const long = ResearchCard.safeParse({ ...research, outsideStudio: Array(9).fill("x"), milestones: Array(9).fill("1. step"), risks: ["r1", "r2", "r3", "r4", "r5", "r6"] });
    expect(long.success && long.data.outsideStudio.length).toBe(5); // trimmed, not rejected
    expect(long.success && long.data.milestones[0]).toBe("step"); // leading numbers stripped
    const obj = PlanCard.safeParse({ ...plan, roles: [{ role: "Fan", can: "tip" }] });
    expect(obj.success && obj.data.roles[0]).toBe("Fan: tip");
    expect(ResearchCard.safeParse({ ...research, stack: [] }).success).toBe(false);
  });
  it("sources must be real http links, and nothing else", () => {
    const r = ResearchCard.safeParse({ ...research, sources: ["https://a.com/x", "javascript:alert(1)", "not a url", 5] });
    expect(r.success && r.data.sources).toEqual(["https://a.com/x"]);
  });
  it("validates the interview: 6 to 10 questions, safe ids, no emojis, no duplicates", () => {
    const q = (id: string) => ({ id, section: "specs", text: "What's the vibe? \u{1F3E1}\u2728", options: [{ id: "A", label: "Cozy \u{1F9D1}\u200D\u{1F91D}\u200D\u{1F9D1}" }, { id: "B", label: "Plain" }] });
    const ok = QuestionSet.safeParse({ questions: Array.from({ length: 6 }, (_, i) => q(`Bad Id ${i}!`)) });
    expect(ok.success).toBe(true);
    if (ok.success) { expect(ok.data.questions[0].id).toBe("bad_id_0"); expect(ok.data.questions[0].text).toBe("What's the vibe?"); expect(ok.data.questions[0].options[0]).toEqual({ id: "a", label: "Cozy" }); expect(ok.data.questions[0].multi).toBe(false); }
    expect(QuestionSet.safeParse({ questions: Array.from({ length: 3 }, (_, i) => q(`q${i}`)) }).success).toBe(false); // too few
    expect(QuestionSet.safeParse({ questions: Array(6).fill(q("same")) }).success).toBe(false); // duplicate question ids
    expect(QuestionSet.safeParse({ questions: [{ ...q("x"), options: [{ id: "a", label: "a" }, { id: "a", label: "b" }] }, ...Array.from({ length: 5 }, (_, i) => q(`q${i}`))] }).success).toBe(false); // duplicate option ids
  });
  it("checks answers: one option for single choice, one or more for multi, only listed ids", () => {
    const [single] = nine(); const multi = nine()[4];
    expect(checkAnswer(single, ["a"])).toMatchObject({ ok: true, a: { optionIds: ["a"] } });
    expect(checkAnswer(single, ["a", "b"])).toMatchObject({ ok: false });
    expect(checkAnswer(single, undefined)).toMatchObject({ ok: false, error: expect.stringMatching(/answer every/) });
    expect(checkAnswer(single, ["zzz"])).toMatchObject({ ok: false, error: expect.stringMatching(/listed options/) });
    const m = checkAnswer(multi, ["a", "c", "a"]);
    expect(m.ok && m.a.optionIds).toEqual(["a", "c"]);
    expect(m.ok && m.a.label).toContain("Option A; Option C");
  });
  it("builds a sheet under Studio's 10,000 character cap, even with maxed-out cards", () => {
    const f = (n: number) => "w".repeat(n);
    const bigPlan = { ...plan, name: "N".repeat(40), oneLiner: f(140), vibe: f(200), audience: f(160), roles: Array(4).fill(f(90)), mustHave: Array(7).fill(f(100)), later: Array(4).fill(f(80)), acceptance: Array(6).fill(f(130)), screens: Array(6).fill(f(80)), rules: Array(6).fill(f(140)), mustNot: Array(4).fill(f(110)) };
    const bigRes = { ...research, architecture: f(600), dataModel: Array(6).fill(f(180)), arcPieces: Array(5).fill({ piece: f(50), why: f(180) }), studioCovers: Array(5).fill(f(140)), milestones: Array(6).fill(f(170)), risks: Array(5).fill(f(170)) };
    const answers = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`q${i}`, { optionIds: ["a"], label: "l".repeat(250) }]));
    const s = buildSheet("i".repeat(280), bigPlan, bigRes, answers);
    expect(s.text.length).toBeLessThanOrEqual(SHEET_MAX);
    expect(SHEET_MAX).toBeLessThan(10_000);
  });
  it("sheet carries the spec, acceptance checks, build order and skills, and leaves out what Studio cannot do", () => {
    const s = buildSheet("A tip jar", plan, research, { q: { optionIds: ["a"], label: "Vibe -> warm" } });
    for (const t of ["Only the creator withdraws", "Vibe -> warm", "Acceptance criteria", "Only the creator withdraws", "Contract first", "1. Contract"]) expect(s.text).toContain(t);
    expect(s.text).not.toContain("Hosting"); // outsideStudio stays in the user's report, not in Studio's prompt
    expect(s.text).not.toContain("Recurring tips".repeat(2));
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
    if (system.includes("Ask exactly 9")) { calls.push("mochi-q"); return JSON.stringify({ questions: nine() }); }
    calls.push("mochi-plan");
    return "```json\n" + JSON.stringify(plan) + "\n```";
  }),
  chatWeb: vi.fn(async () => { calls.push("scout"); return { text: JSON.stringify({ ...research, sources: ["https://made-up.example/never-trusted"] }), sources: ["https://real.example/found"] }; }),
}));
vi.mock("@/lib/indexer", () => ({ client: () => ({ getTransactionReceipt: async () => null }) }));

describe("dream flow", () => {
  beforeAll(async () => { setDb(createClient({ url: ":memory:" })); await migrate(); });
  beforeEach(async () => { await db().execute("DELETE FROM dreams"); calls.length = 0; });
  const mk = async (status = "paid") => {
    await db().execute({ sql: "INSERT INTO dreams(id,wallet,idea,status,created_at,updated_at) VALUES('d1','0xabc','a tip jar for creators',?,1,1)", args: [status] });
    const { getDream } = await import("@/lib/dreams/store"); return (await getDream("d1", "0xabc"))!;
  };
  const answerAll = (qs: Question[]) => Object.fromEntries(qs.map((q) => [q.id, { optionIds: q.multi ? ["a", "b"] : ["a"] }]));
  it("runs paid -> asking -> planned -> researched -> ready, one model call per step", async () => {
    const { advance, getDream, view } = await import("@/lib/dreams/store");
    let d = await advance(await mk(), undefined); expect(d.status).toBe("asking"); expect(d.questions).toHaveLength(9);
    expect(new Set(d.questions.map((q) => q.section))).toEqual(new Set(["specs", "features", "design"]));
    d = await advance((await getDream("d1", "0xabc"))!, answerAll(d.questions)); expect(d.status).toBe("planned"); expect(d.calls).toBe(2);
    d = await advance((await getDream("d1", "0xabc"))!); expect(d.status).toBe("researched"); expect(d.calls).toBe(3);
    expect(d.research!.sources).toEqual(["https://real.example/found"]); // links come from the search, never from the model's own text
    expect(view(d).followups).toHaveLength(1);
    expect(view(d).research).not.toHaveProperty("followups");
    d = await advance((await getDream("d1", "0xabc"))!, { f1: { optionIds: ["b"] } }); expect(d.status).toBe("ready");
    expect(d.sheet).toContain("Tip Jar"); expect(d.sheet).toContain("Fee? -> 1%"); expect(d.sheet!.length).toBeLessThanOrEqual(SHEET_MAX);
    expect(calls).toEqual(["mochi-q", "mochi-plan", "scout"]);
  });
  it("repeating a finished step does not call the model again", async () => {
    const { advance } = await import("@/lib/dreams/store");
    const d = await advance(await mk(), undefined);
    await advance(d, answerAll(d.questions));
    const n = calls.length;
    const { getDream } = await import("@/lib/dreams/store");
    const again = (await getDream("d1", "0xabc"))!; expect(again.status).toBe("planned");
    await advance({ ...again, status: "ready" } as typeof again); // a ready dream is a no-op
    expect(calls.length).toBe(n);
  });
  it("refuses unpaid dreams, unanswered questions, two options on a single choice, and made-up options", async () => {
    const { advance, getDream } = await import("@/lib/dreams/store");
    await expect(advance(await mk("new"))).rejects.toThrow(/paid/);
    await db().execute("DELETE FROM dreams");
    const d = await advance(await mk(), undefined);
    await expect(advance(d, {})).rejects.toThrow(/answer every/);
    const two = { ...answerAll(d.questions), q0: { optionIds: ["a", "b"] } };
    await expect(advance((await getDream("d1", "0xabc"))!, two)).rejects.toThrow(/Only one option/);
    const bad = { ...answerAll(d.questions), q1: { optionIds: ["zzz"] } };
    await expect(advance((await getDream("d1", "0xabc"))!, bad)).rejects.toThrow(/listed options/);
    expect((await getDream("d1", "0xabc"))!.status).toBe("asking"); // a refused answer changes nothing
  });
  it("caps model calls per dream", async () => {
    const { advance, getDream } = await import("@/lib/dreams/store");
    await db().execute({ sql: "INSERT INTO dreams(id,wallet,idea,status,calls,created_at,updated_at) VALUES('d2','0xabc','x idea long enough','paid',8,1,1)" });
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
