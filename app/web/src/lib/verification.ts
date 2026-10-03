/**
 * Verified = honour and trust. Earned by record, never bought. The team grants and can remove it by hand.
 * The team can also grant it by hand (see /api/admin/verify). Founding is a separate, clearly different mark.
 */
export const VERIFY_RULES = { paidJobs: 3, clients: 3, reviewers: 3, minRating: 4.5, minPaidUsd: 5, accountDays: 30 } as const;

export type VerifyInput = {
  paidJobs: number;          // completed/settled jobs as artisan, $5+ each
  clients: number;           // distinct clients across those jobs
  abandoned: number;         // jobs abandoned by me
  deadlocked: number;        // disputes that ended in deadlock against me is counted by the team; kept here for display
  ratingAvg: number | null;
  reviewers: number;         // DISTINCT people who rated me (one person cannot carry a rating)
  accountDays: number;
  hasProofLink: boolean;     // X or GitHub link on profile (team checks it when granting)
};
export type VerifyCheck = { key: string; label: string; ok: boolean; detail: string };

export function verifyChecks(i: VerifyInput): VerifyCheck[] {
  const R = VERIFY_RULES;
  return [
    { key: "identity", label: "Public identity linked (X or GitHub)", ok: i.hasProofLink, detail: i.hasProofLink ? "Linked" : "Add an X or GitHub link to your profile" },
    { key: "jobs", label: `${R.paidJobs} paid jobs of $${R.minPaidUsd}+`, ok: i.paidJobs >= R.paidJobs, detail: `${i.paidJobs} of ${R.paidJobs}` },
    { key: "clients", label: `${R.clients} different clients`, ok: i.clients >= R.clients, detail: `${i.clients} of ${R.clients}` },
    { key: "reviewers", label: `Rated by ${R.reviewers} different people`, ok: i.reviewers >= R.reviewers, detail: `${i.reviewers} of ${R.reviewers}` },
    { key: "rating", label: `Average ${R.minRating}\u2605 or better`, ok: i.reviewers >= R.reviewers && (i.ratingAvg ?? 0) >= R.minRating, detail: i.ratingAvg ? `${i.ratingAvg.toFixed(1)}\u2605 from ${i.reviewers}` : "No ratings yet" },
    { key: "clean", label: "Never abandoned a job", ok: i.abandoned === 0, detail: i.abandoned === 0 ? "Clean record" : `${i.abandoned} abandoned` },
    { key: "age", label: `Account at least ${R.accountDays} days old`, ok: i.accountDays >= R.accountDays, detail: `${Math.min(i.accountDays, 999)} days` },
  ];
}
export const meetsRules = (i: VerifyInput) => verifyChecks(i).every((c) => c.ok);
