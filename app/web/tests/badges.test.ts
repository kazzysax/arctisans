import { describe, it, expect } from "vitest";
import { computeBadges, type BadgeFacts } from "@/lib/badges";
import { computeReputation } from "@/lib/reputation";

const base = (): BadgeFacts => ({
  rep: computeReputation("0xa", [], [], []), level: 1, verified: false, onTimeCount: 0, ratingsInOrder: [],
  maxJobsFromOneClient: 0, agentsHired: 0, joinedAt: Date.UTC(2026, 9, 10), launchAt: Date.UTC(2026, 9, 1),
});
const get = (f: BadgeFacts, id: string) => computeBadges(f).find((b) => b.id === id)!;

describe("badges", () => {
  it("a brand new account has only Early", () => {
    expect(computeBadges(base()).filter((b) => b.earned).map((b) => b.id)).toEqual(["early"]);
  });
  it("5-star streak needs five in a row", () => {
    const f = base(); f.ratingsInOrder = [5, 5, 4, 5, 5, 5, 5];
    expect(get(f, "five-star-streak")).toMatchObject({ earned: false, progress: 4 });
    f.ratingsInOrder.push(5); expect(get(f, "five-star-streak").earned).toBe(true);
  });
  it("clean record resets with any deadlock", () => {
    const f = base(); f.rep = { ...f.rep, completed: 12 };
    expect(get(f, "clean-record").earned).toBe(true);
    f.rep = { ...f.rep, deadlocked: 1 }; expect(get(f, "clean-record").earned).toBe(false);
  });
  it("progress is capped at the goal and money is in dollars", () => {
    const f = base(); f.rep = { ...f.rep, earned: 2_500_000_000, tipsCount: 40 };
    expect(get(f, "earned-1k")).toMatchObject({ earned: true, progress: 1000 });
    expect(get(f, "tipped-10").progress).toBe(10);
  });
  it("levels map to Trusted / Pro badges; late joiners are not Early", () => {
    const f = base(); f.level = 3; f.joinedAt = Date.UTC(2026, 11, 1);
    expect(get(f, "trusted").earned && get(f, "pro").earned).toBe(true);
    expect(get(f, "early").earned).toBe(false);
  });
});
