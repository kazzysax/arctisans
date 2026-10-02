/** Reputation is computed ONLY from on-chain facts (events) plus verified reviews. No likes, no follower counts. */
export const OUTCOME = { Completed: 7, Settled: 8, Deadlocked: 9, Abandoned: 10, Cancelled: 11 } as const;

export type JobClosedEv = { jobId: number; client: string; artisan: string; outcome: number; paidToArtisan: number; refundedToClient: number; onTime: boolean; ts?: number };
export type ReviewEv = { jobId: number; reviewer: string; subject: string; rating: number };
export type TipEv = { to: string; from: string; amount: number };

export type Reputation = {
  wallet: string;
  jobsAsArtisan: number; jobsAsClient: number;
  completed: number; settled: number; deadlocked: number; abandonedByMe: number; cancelled: number;
  earned: number; spent: number;
  onTimeRate: number | null;
  ratingAvg: number | null; ratingCount: number; ratingsGiven: number;
  tipsReceived: number; tipsCount: number; tipsGiven: number;
  uniqueClients: number;
  skills: Record<string, number>;
};

const lc = (s: string) => s.toLowerCase();

export function computeReputation(
  wallet: string,
  closed: JobClosedEv[],
  reviews: ReviewEv[],
  tips: TipEv[],
  jobSkills: Map<number, string[]> = new Map(),
): Reputation {
  const me = lc(wallet);
  const r: Reputation = {
    wallet: me, jobsAsArtisan: 0, jobsAsClient: 0, completed: 0, settled: 0, deadlocked: 0, abandonedByMe: 0, cancelled: 0,
    earned: 0, spent: 0, onTimeRate: null, ratingAvg: null, ratingCount: 0, ratingsGiven: 0,
    tipsReceived: 0, tipsCount: 0, tipsGiven: 0, uniqueClients: 0, skills: {},
  };
  const clients = new Set<string>();
  let onTimeN = 0, onTimeD = 0;
  for (const j of closed) {
    const asArtisan = lc(j.artisan) === me, asClient = lc(j.client) === me;
    if (!asArtisan && !asClient) continue;
    // Cancelled before any work: not a job that happened. Still tracked, never counted as experience.
    if (j.outcome === OUTCOME.Cancelled) { r.cancelled++; continue; }
    if (asArtisan) {
      r.jobsAsArtisan++;
      r.earned += j.paidToArtisan;
      if (j.outcome === OUTCOME.Completed) {
        r.completed++;
        clients.add(lc(j.client));
        onTimeD++; if (j.onTime) onTimeN++;
        for (const s of jobSkills.get(j.jobId) ?? []) r.skills[s] = (r.skills[s] ?? 0) + 1;
      }
      if (j.outcome === OUTCOME.Abandoned) r.abandonedByMe++;
    }
    if (asClient) { r.jobsAsClient++; r.spent += j.paidToArtisan; }
    if (j.outcome === OUTCOME.Settled) r.settled++;
    if (j.outcome === OUTCOME.Deadlocked) r.deadlocked++;
  }
  r.uniqueClients = clients.size;
  r.onTimeRate = onTimeD ? onTimeN / onTimeD : null;
  let sum = 0;
  for (const v of reviews) {
    if (lc(v.subject) === me) { sum += v.rating; r.ratingCount++; }
    if (lc(v.reviewer) === me) r.ratingsGiven++;
  }
  r.ratingAvg = r.ratingCount ? Math.round((sum / r.ratingCount) * 100) / 100 : null;
  for (const t of tips) {
    if (lc(t.to) === me) { r.tipsReceived += t.amount; r.tipsCount++; }
    if (lc(t.from) === me) r.tipsGiven += t.amount;
  }
  return r;
}
