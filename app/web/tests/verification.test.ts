import { describe, it, expect } from "vitest";
import { verifyChecks, meetsRules, type VerifyInput } from "@/lib/verification";

const good = (): VerifyInput => ({ paidJobs: 3, clients: 3, abandoned: 0, deadlocked: 0, ratingAvg: 4.8, reviewers: 3, accountDays: 40, hasProofLink: true });

describe("verification rules", () => {
  it("meets the rules with a clean, rated, 30-day record", () => expect(meetsRules(good())).toBe(true));
  it("one friend rating many times is not enough: needs 3 different reviewers", () => {
    expect(meetsRules({ ...good(), reviewers: 1, ratingAvg: 5 })).toBe(false);
    expect(verifyChecks({ ...good(), reviewers: 2 }).find((c) => c.key === "rating")!.ok).toBe(false);
  });
  it("needs 3 clients, not 3 jobs from one", () => expect(meetsRules({ ...good(), clients: 1 })).toBe(false));
  it("rating must be 4.5 or better", () => expect(meetsRules({ ...good(), ratingAvg: 4.4 })).toBe(false));
  it("one abandoned job disqualifies", () => expect(meetsRules({ ...good(), abandoned: 1 })).toBe(false));
  it("account must be 30 days old", () => expect(meetsRules({ ...good(), accountDays: 29 })).toBe(false));
  it("needs a public X or GitHub link", () => expect(meetsRules({ ...good(), hasProofLink: false })).toBe(false));
});
