import { db } from "@/db";
import { computeReputation, type JobClosedEv, type ReviewEv, type TipEv } from "./reputation";
import { imageUrl } from "./images";
import { computeBadges } from "./badges";
import { artisanLevel } from "./level";

const lc = (s: string) => s.toLowerCase();
const json = <T>(v: unknown, d: T): T => { try { return JSON.parse(String(v)) as T; } catch { return d; } };

export async function getProfile(handleOrWallet: string) {
  const k = lc(handleOrWallet);
  const r = await db().execute({ sql: "SELECT * FROM users WHERE lower(handle)=? OR wallet=?", args: [k, k] });
  const u = r.rows[0];
  if (!u) return null;
  return {
    wallet: String(u.wallet), handle: String(u.handle), displayName: String(u.display_name), kind: String(u.kind),
    ownerWallet: u.owner_wallet ? String(u.owner_wallet) : null, title: u.title ? String(u.title) : null,
    bio: u.bio ? String(u.bio) : null, scope: u.scope ? String(u.scope) : null, skills: json<string[]>(u.skills, []),
    links: json<{ label: string; url: string }[]>(u.links, []), city: u.city ? String(u.city) : null,
    avatar: u.avatar ? imageUrl(String(u.avatar)) : null, verified: !!Number(u.verified), createdAt: Number(u.created_at),
  };
}

export async function getReputation(wallet: string) {
  const w = lc(wallet);
  const closedRows = await db().execute("SELECT args FROM chain_events WHERE name='JobClosed'");
  const closed: JobClosedEv[] = closedRows.rows.map((x) => {
    const a = json<Record<string, string>>(x.args, {});
    return { jobId: Number(a.jobId), client: a.client, artisan: a.artisan, outcome: Number(a.outcome), paidToArtisan: Number(a.paidToArtisan), refundedToClient: Number(a.refundedToClient), onTime: a.onTime === "true" || (a.onTime as unknown) === true };
  }).filter((j) => lc(j.client) === w || lc(j.artisan) === w);
  const rv = await db().execute({ sql: "SELECT job_chain_id, reviewer, subject, rating FROM reviews WHERE reviewer=? OR subject=?", args: [w, w] });
  const reviews: ReviewEv[] = rv.rows.map((x) => ({ jobId: Number(x.job_chain_id), reviewer: String(x.reviewer), subject: String(x.subject), rating: Number(x.rating) }));
  const tp = await db().execute({ sql: "SELECT from_wallet, to_wallet, amount FROM tips WHERE from_wallet=? OR to_wallet=?", args: [w, w] });
  const tips: TipEv[] = tp.rows.map((x) => ({ from: String(x.from_wallet), to: String(x.to_wallet), amount: Number(x.amount) }));
  const sk = await db().execute("SELECT chain_job_id, skills FROM jobs WHERE chain_job_id IS NOT NULL");
  const jobSkills = new Map<number, string[]>(sk.rows.map((x) => [Number(x.chain_job_id), json<string[]>(x.skills, [])]));
  return computeReputation(w, closed, reviews, tips, jobSkills);
}

export type FeedQuery = { feed: "work" | "request"; skill?: string; city?: string; kind?: "human" | "agent"; following?: string; author?: string; before?: number; limit?: number };
export async function listFeed(q: FeedQuery) {
  const where: string[] = ["p.feed = ?", "p.hidden = 0"]; const args: (string | number)[] = [q.feed];
  if (q.skill) { where.push("lower(p.skill) = ?"); args.push(lc(q.skill)); }
  if (q.city) { where.push("lower(p.city) = ?"); args.push(lc(q.city)); }
  if (q.kind) { where.push("u.kind = ?"); args.push(q.kind); }
  if (q.following) { where.push("p.author_wallet IN (SELECT followee FROM follows WHERE follower = ?)"); args.push(lc(q.following)); }
  if (q.author) { where.push("(lower(u.handle) = ? OR p.author_wallet = ?)"); args.push(lc(q.author), lc(q.author)); }
  if (q.before) { where.push("p.created_at < ?"); args.push(q.before); }
  args.push(Math.min(q.limit ?? 20, 50));
  const r = await db().execute({
    sql: `SELECT p.*, u.handle, u.display_name, u.kind, u.verified,
            (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) AS likes
          FROM posts p JOIN users u ON u.wallet = p.author_wallet
          WHERE ${where.join(" AND ")} ORDER BY p.created_at DESC LIMIT ?`,
    args,
  });
  return r.rows.map((x) => ({
    id: String(x.id), authorWallet: String(x.author_wallet), handle: String(x.handle), displayName: String(x.display_name),
    kind: String(x.kind), verified: !!Number(x.verified), feed: String(x.feed), body: x.body ? String(x.body) : "",
    images: json<string[]>(x.images, []).map(imageUrl), skill: x.skill ? String(x.skill) : null, city: x.city ? String(x.city) : null,
    budget: x.budget ? Number(x.budget) : null, likes: Number(x.likes), createdAt: Number(x.created_at),
  }));
}

export async function searchProfiles(p: { q?: string; skill?: string; kind?: "human" | "agent"; minRating?: number; limit?: number }) {
  const where: string[] = ["1=1"]; const args: (string | number)[] = [];
  if (p.q) { where.push("(lower(handle) LIKE ? OR lower(display_name) LIKE ? OR lower(title) LIKE ?)"); const l = `%${lc(p.q).replace(/[%_]/g, "")}%`; args.push(l, l, l); }
  if (p.skill) { where.push("lower(skills) LIKE ?"); args.push(`%"${lc(p.skill).replace(/[%_"]/g, "")}"%`); }
  if (p.kind) { where.push("kind = ?"); args.push(p.kind); }
  if (p.minRating) { where.push("(SELECT AVG(rating) FROM reviews r WHERE r.subject = users.wallet) >= ?"); args.push(p.minRating); }
  args.push(Math.min(p.limit ?? 20, 50));
  const r = await db().execute({ sql: `SELECT wallet FROM users WHERE ${where.join(" AND ")} ORDER BY created_at DESC LIMIT ?`, args });
  return Promise.all(r.rows.map((x) => getProfile(String(x.wallet))));
}

/** Platform launch (for the Early Arctisan badge). */
export const LAUNCH_AT = Number(process.env.LAUNCH_AT ?? Date.UTC(2026, 9, 14));

/** Reputation card + level + badges, all derived from onchain events. */
export async function getCard(wallet: string, joinedAt: number, verified: boolean) {
  const w = lc(wallet);
  const rep = await getReputation(w);
  const { level, capBps } = await artisanLevel(w as `0x${string}`);
  const closedRows = await db().execute("SELECT args FROM chain_events WHERE name='JobClosed'");
  const mine = closedRows.rows.map((x) => json<Record<string, unknown>>(x.args, {}))
    .filter((a) => Number(a.outcome) === 7 && (lc(String(a.artisan)) === w || lc(String(a.client)) === w));
  const asArtisan = mine.filter((a) => lc(String(a.artisan)) === w);
  const perClient = new Map<string, number>();
  for (const a of asArtisan) perClient.set(lc(String(a.client)), (perClient.get(lc(String(a.client))) ?? 0) + 1);
  const hiredArtisans = mine.filter((a) => lc(String(a.client)) === w).map((a) => lc(String(a.artisan)));
  let agentsHired = 0;
  if (hiredArtisans.length) {
    const q = await db().execute({ sql: `SELECT COUNT(*) n FROM users WHERE kind='agent' AND wallet IN (${hiredArtisans.map(() => "?").join(",")})`, args: hiredArtisans });
    agentsHired = Number(q.rows[0]?.n ?? 0);
  }
  const rv = await db().execute({ sql: "SELECT rating FROM reviews WHERE subject=? ORDER BY created_at ASC", args: [w] });
  const badges = computeBadges({
    rep, level: level.level, verified,
    onTimeCount: asArtisan.filter((a) => a.onTime === true || a.onTime === "true").length,
    ratingsInOrder: rv.rows.map((x) => Number(x.rating)),
    maxJobsFromOneClient: Math.max(0, ...perClient.values()),
    agentsHired, joinedAt, launchAt: LAUNCH_AT,
  });
  return { reputation: rep, level: { ...level, upfrontPct: capBps / 100 }, badges };
}
