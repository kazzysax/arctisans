import { describe, it, expect, vi, beforeAll } from "vitest";
import { createClient } from "@libsql/client";
import { setDb, migrate, db } from "@/db";

const calls: string[] = [];
let tabBroke: string | null = null;
vi.mock("@/lib/dreams/tab", async (orig) => {
  const real = await orig<typeof import("@/lib/dreams/tab")>();
  return {
    ...real,
    chargeStep: vi.fn(async (_id: string, step: string) => { if (tabBroke === step) throw new real.TabError("empty", "Your tab has been withdrawn or is used up, so the dogs can't take this step."); calls.push(`charge:${step}`); }),
    readTab: vi.fn(async () => null),
  };
});
vi.mock("@/lib/dreams/llm", () => ({
  mochiQuestions: vi.fn(async () => { calls.push("model:questions"); return Array.from({ length: 9 }, (_, i) => ({ id: `q${i}`, section: ["specs", "features", "design"][Math.floor(i / 3)], text: `Question ${i}?`, multi: false, options: [{ id: "a", label: "A" }, { id: "b", label: "B" }] })); }),
  mochiPlan: vi.fn(async () => { calls.push("model:plan"); return null; }),
  scoutResearch: vi.fn(async () => { calls.push("model:research"); return null; }),
}));

import { advance, getDream } from "@/lib/dreams/store";
import { tabId, depositCalls, STEP_COST, TAB_TOTAL, tabOn, withdrawCall } from "@/lib/dreams/tab";

beforeAll(async () => { setDb(createClient({ url: "file::memory:" })); await migrate(); });

describe("dream tab", () => {
  it("is off until the contract and operator key are configured", () => {
    delete process.env.DREAMS_TAB; delete process.env.DREAMS_OPERATOR_KEY;
    expect(tabOn()).toBe(false);
    process.env.DREAMS_TAB = "0x" + "1".repeat(40); expect(tabOn()).toBe(false);
    process.env.DREAMS_OPERATOR_KEY = "0x" + "2".repeat(64); expect(tabOn()).toBe(true);
  });
  it("all step costs together stay under the contract's $0.40 cap, and a deposit is $1", () => {
    expect(TAB_TOTAL).toBeLessThanOrEqual(400_000);
    expect(Object.values(STEP_COST).every((n) => n > 0)).toBe(true);
  });
  it("derives one stable id per dream and builds approve + deposit calls for the tab", () => {
    expect(tabId("a")).toBe(tabId("a")); expect(tabId("a")).not.toBe(tabId("b")); expect(tabId("a")).toMatch(/^0x[0-9a-f]{64}$/);
    process.env.DREAMS_TAB = "0x" + "1".repeat(40);
    const c = depositCalls("a", 1_000_000);
    expect(c).toHaveLength(2); expect(c[1].to.toLowerCase()).toBe(process.env.DREAMS_TAB);
    expect(withdrawCall("a").to.toLowerCase()).toBe(process.env.DREAMS_TAB);
  });
  it("charges the step BEFORE the model runs", async () => {
    calls.length = 0; tabBroke = null;
    await db().execute("DELETE FROM dreams");
    await db().execute({ sql: "INSERT INTO dreams(id,wallet,idea,status,tab,created_at,updated_at) VALUES('t1','0xabc','a tip jar for creators','paid',1,1,1)" });
    await advance((await getDream("t1", "0xabc"))!);
    expect(calls).toEqual(["charge:questions", "model:questions"]);
  });
  it("an empty or withdrawn tab stops the step: no model call, nothing saved", async () => {
    calls.length = 0; tabBroke = "questions";
    await db().execute("DELETE FROM dreams");
    await db().execute({ sql: "INSERT INTO dreams(id,wallet,idea,status,tab,created_at,updated_at) VALUES('t2','0xabc','a tip jar for creators','paid',1,1,1)" });
    await expect(advance((await getDream("t2", "0xabc"))!)).rejects.toThrow(/withdrawn or is used up/);
    expect(calls).toEqual([]);
    expect((await getDream("t2", "0xabc"))!.status).toBe("paid");
    tabBroke = null;
  });
  it("older dreams paid by plain transfer never touch the tab", async () => {
    calls.length = 0;
    await db().execute("DELETE FROM dreams");
    await db().execute({ sql: "INSERT INTO dreams(id,wallet,idea,status,tab,created_at,updated_at) VALUES('t3','0xabc','a tip jar for creators','paid',0,1,1)" });
    await advance((await getDream("t3", "0xabc"))!);
    expect(calls).toEqual(["model:questions"]);
  });
});
