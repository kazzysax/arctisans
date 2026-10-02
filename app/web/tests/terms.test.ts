import { describe, it, expect } from "vitest";
import { TermsSchema, hashTerms, canonicalize, defaultSplit, totalOf, levelOf } from "@/lib/terms";
import { usdcToMicro, microToUsdc } from "@/lib/money";

const A = "0x00000000000000000000000000000000000000a1", C = "0x00000000000000000000000000000000000000c1";
const base = { version: 1 as const, client: C, artisan: A, title: "Logo", deliverables: ["3 logos"], doneMeans: "PNG and SVG delivered", revisions: 2, deadline: 2000000000, upfront: 5_000_000, milestones: [5_000_000] };

describe("terms", () => {
  it("hash is stable regardless of key order", () => {
    const t1 = TermsSchema.parse(base);
    const t2 = TermsSchema.parse(JSON.parse(JSON.stringify({ milestones: base.milestones, upfront: base.upfront, deadline: base.deadline, revisions: 2, doneMeans: base.doneMeans, deliverables: base.deliverables, title: "Logo", artisan: A, client: C, version: 1 })));
    expect(hashTerms(t1)).toBe(hashTerms(t2));
  });
  it("any change changes the hash", () => {
    expect(hashTerms(TermsSchema.parse(base))).not.toBe(hashTerms(TermsSchema.parse({ ...base, revisions: 3 })));
  });
  it("enforces $1 min, $100 max, distinct parties", () => {
    expect(() => TermsSchema.parse({ ...base, upfront: 0, milestones: [999_999] })).toThrow();
    expect(() => TermsSchema.parse({ ...base, upfront: 0, milestones: [100_000_001] })).toThrow();
    expect(() => TermsSchema.parse({ ...base, artisan: C })).toThrow();
    expect(TermsSchema.parse({ ...base, upfront: 0, milestones: [100_000_000] })).toBeTruthy();
  });
  it("default plan pays on approval; upfront only within the level cap, and sums exactly", () => {
    expect(defaultSplit(33_333_333)).toEqual({ upfront: 0, milestones: [33_333_333] });
    const t = defaultSplit(33_333_333, 3000); expect(t.upfront).toBe(9_999_999); expect(totalOf(t)).toBe(33_333_333);
    expect(defaultSplit(10_000_000, 3000, 5000).upfront).toBe(3_000_000); // can't ask beyond the cap
    expect(defaultSplit(10_000_000, 5000, 2000).upfront).toBe(2_000_000);
  });
  it("levels mirror the contract", () => {
    const r = { completed: 20, uniqueClients: 10, abandoned: 0, verified: true };
    expect(levelOf(r).name).toBe("Pro");
    expect(levelOf({ ...r, verified: false }).name).toBe("New");
    expect(levelOf({ ...r, abandoned: 1 }).name).toBe("New");
    expect(levelOf({ ...r, completed: 5, uniqueClients: 3 }).name).toBe("Trusted");
    expect(levelOf({ ...r, completed: 25, uniqueClients: 2 }).name).toBe("New");
  });
  it("canonicalize sorts keys", () => expect(canonicalize({ b: 1, a: [2, { d: 1, c: 2 }] })).toBe('{"a":[2,{"c":2,"d":1}],"b":1}'));
  it("money parsing", () => {
    expect(usdcToMicro("12.5")).toBe(12_500_000);
    expect(usdcToMicro("0.000001")).toBe(1);
    expect(() => usdcToMicro("1.0000001")).toThrow();
    expect(() => usdcToMicro("-1")).toThrow();
    expect(microToUsdc(12_500_000)).toBe("12.5");
    expect(microToUsdc(1_000_000)).toBe("1");
  });
});
