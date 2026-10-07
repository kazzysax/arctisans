/** Achievement badges. Earned automatically from onchain facts (reputation + review/tip history), never self-claimed. */
import type { Reputation } from "./reputation";

export type BadgeId =
  | "first-job" | "on-time-10" | "five-star-streak" | "clean-record" | "verified" | "tipped-10"
  | "hires-agents" | "repeat-client" | "early" | "earned-1k" | "trusted" | "pro";

export type Badge = { id: BadgeId; name: string; how: string; earned: boolean; progress: number; goal: number };

export type BadgeFacts = {
  rep: Reputation;
  level: 1 | 2 | 3;
  verified: boolean;
  onTimeCount: number;              // completed jobs delivered by the deadline
  ratingsInOrder: number[];         // ratings received, oldest first
  maxJobsFromOneClient: number;
  agentsHired: number;              // completed jobs where I was client and the artisan is an agent
  joinedAt: number;                 // ms
  launchAt: number;                 // ms, platform launch
};

const MONTH = 30 * 24 * 3600 * 1000;
const usd = (micro: number) => micro / 1e6;

function streak(r: number[]) { let best = 0, cur = 0; for (const x of r) { cur = x === 5 ? cur + 1 : 0; best = Math.max(best, cur); } return best; }

export function computeBadges(f: BadgeFacts): Badge[] {
  const r = f.rep;
  const b = (id: BadgeId, name: string, how: string, progress: number, goal: number): Badge =>
    ({ id, name, how, progress: Math.min(progress, goal), goal, earned: progress >= goal });
  return [
    b("first-job", "First job", "Complete your first paid job", Math.max(r.completed, r.paid), 1),
    b("verified", "Verified", "Prove you own your GitHub or X", f.verified ? 1 : 0, 1),
    b("on-time-10", "On time ×10", "Deliver 10 jobs before the deadline", f.onTimeCount, 10),
    b("five-star-streak", "5★ streak", "Five 5-star reviews in a row", streak(f.ratingsInOrder), 5),
    b("clean-record", "Clean record", "10 jobs with no deadlocks or abandoned work", r.deadlocked === 0 && r.abandonedByMe === 0 ? r.completed : 0, 10),
    b("tipped-10", "Tipped", "Receive 10 tips", r.tipsCount, 10),
    b("repeat-client", "Repeat client", "Be hired by the same client 3 times", f.maxJobsFromOneClient, 3),
    b("hires-agents", "Hires agents", "Complete a job with an AI agent", f.agentsHired, 1),
    b("earned-1k", "$1k earned", "Earn $1,000 on Arctisans", Math.floor(usd(r.earned)), 1000),
    b("trusted", "Trusted", "Unlock 30% upfront: verified, 5 jobs, 3 clients", f.level >= 2 ? 1 : 0, 1),
    b("pro", "Pro", "Unlock 50% upfront: verified, 20 jobs, 10 clients", f.level >= 3 ? 1 : 0, 1),
    b("early", "Early Arctisan", "Joined in the first month", f.joinedAt - f.launchAt <= MONTH ? 1 : 0, 1),
  ];
}
