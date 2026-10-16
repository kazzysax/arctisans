import { describe, it, expect, beforeAll, vi } from "vitest";
import { createClient } from "@libsql/client";
import { setDb, migrate, db } from "@/db";

const sent: string[] = [];
vi.mock("viem", async (orig) => ({ ...(await orig<typeof import("viem")>()), createWalletClient: () => ({ writeContract: async (a: { args: string[] }) => { sent.push(a.args[0]); return "0xabc"; } }) }));
import { maybeReward, rewardCatchUp } from "@/lib/rewards";

const user = (i: number, t: number) => db().execute({ sql: "INSERT INTO users(id,wallet,handle,display_name,created_at) VALUES(?,?,?,?,?)", args: [`u${i}`, `0x${String(i).padStart(40, "0")}`, `h${i}`, `H${i}`, t] });
const w = (i: number) => `0x${String(i).padStart(40, "0")}`;

describe("launch gift", () => {
  beforeAll(async () => {
    setDb(createClient({ url: ":memory:" })); await migrate();
    process.env.REWARD_KEY = "0x" + "11".repeat(32); process.env.REWARD_START = "1000";
    await user(0, 500);                              // signed up before launch
    for (let i = 1; i <= 12; i++) await user(i, 1000 + i);
  });
  it("pays an early sign-up once, on the first post only", async () => {
    expect(await maybeReward(w(1), "p1")).toBe("paid");
    expect(await maybeReward(w(1), "p2")).toBe("skipped");
    expect(sent).toEqual([w(1)]);
  });
  it("pays nothing before the first post (no post, no call)", () => { expect(sent).not.toContain(w(2)); });
  it("skips sign-ups before the launch and after the first 10", async () => {
    expect(await maybeReward(w(0), "p")).toBe("skipped");
    expect(await maybeReward(w(11), "p")).toBe("skipped");
    expect(await maybeReward(w(12), "p")).toBe("skipped");
    expect(await maybeReward(w(10), "p")).toBe("paid");
  });
  it("does nothing when not configured", async () => {
    delete process.env.REWARD_KEY;
    expect(await maybeReward(w(3), "p")).toBe("skipped");
  });
  it("catch-up pays a qualifying poster who was missed, and only once", async () => {
    process.env.REWARD_KEY = "0x" + "11".repeat(32);
    await db().execute({ sql: "INSERT INTO posts(id,author_wallet,feed,body,images,created_at) VALUES(?,?,?,?,?,?)", args: ["px", w(4), "work", "x", "[]", Date.now()] });
    const before = sent.length;
    expect(await rewardCatchUp()).toBeGreaterThanOrEqual(1);
    expect(sent.slice(before)).toContain(w(4));
    const mid = sent.length;
    await rewardCatchUp();
    expect(sent.length).toBe(mid);
  });
});
