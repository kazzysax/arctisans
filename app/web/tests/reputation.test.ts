import { describe, it, expect } from "vitest";
import { computeReputation, OUTCOME } from "@/lib/reputation";

const A = "0xA1", C1 = "0xC1", C2 = "0xC2";
const job = (id: number, client: string, outcome: number, paid: number, onTime = true) => ({ jobId: id, client, artisan: A, outcome, paidToArtisan: paid, refundedToClient: 0, onTime });

describe("reputation from facts", () => {
  it("counts completed jobs, earnings, on-time, unique clients, skills", () => {
    const r = computeReputation(A, [job(1, C1, OUTCOME.Completed, 50e6), job(2, C2, OUTCOME.Completed, 20e6, false), job(3, C1, OUTCOME.Completed, 10e6)],
      [], [], new Map([[1, ["logo"]], [3, ["logo", "brand"]]]));
    expect(r.completed).toBe(3); expect(r.earned).toBe(80e6); expect(r.uniqueClients).toBe(2);
    expect(r.onTimeRate).toBeCloseTo(2 / 3); expect(r.skills).toEqual({ logo: 2, brand: 1 });
  });
  it("cancelled jobs never count as experience", () => {
    const r = computeReputation(A, [job(1, C1, OUTCOME.Cancelled, 0)], [], []);
    expect(r.jobsAsArtisan).toBe(0); expect(r.cancelled).toBe(1); expect(r.onTimeRate).toBeNull();
  });
  it("shows settlements, deadlocks and abandons honestly", () => {
    const r = computeReputation(A, [job(1, C1, OUTCOME.Settled, 10e6), job(2, C1, OUTCOME.Deadlocked, 5e6), job(3, C1, OUTCOME.Abandoned, 0)], [], []);
    expect(r.settled).toBe(1); expect(r.deadlocked).toBe(1); expect(r.abandonedByMe).toBe(1); expect(r.completed).toBe(0);
  });
  it("ratings average only reviews about me; case-insensitive", () => {
    const r = computeReputation(A.toLowerCase(), [], [{ jobId: 1, reviewer: C1, subject: A, rating: 5 }, { jobId: 2, reviewer: C2, subject: A, rating: 4 }, { jobId: 3, reviewer: A, subject: C1, rating: 1 }], []);
    expect(r.ratingAvg).toBe(4.5); expect(r.ratingCount).toBe(2); expect(r.ratingsGiven).toBe(1);
  });
  it("tips received and given", () => {
    const r = computeReputation(A, [], [], [{ to: A, from: C1, amount: 2e6 }, { to: A, from: C2, amount: 1e6 }, { to: C1, from: A, amount: 5e6 }]);
    expect(r.tipsReceived).toBe(3e6); expect(r.tipsCount).toBe(2); expect(r.tipsGiven).toBe(5e6);
  });
});
