import { z } from "zod";
import { getAddress } from "viem";
import { db } from "@/db";
import { ok, fail, route } from "@/lib/api";
import { requireSession } from "@/lib/session";
import { TermsSchema, hashTerms, defaultSplit, totalOf, maxUpfront } from "@/lib/terms";
import { artisanLevel } from "@/lib/level";
import { proposeCalls } from "@/lib/tx";
import { after } from "next/server";
import { runNative, touchesNative } from "@/lib/native/worker";

// Draft body: either explicit upfront/milestones, or just `total` (+ optional `upfrontBps`). Default: paid on approval.
// Upfront is only allowed up to the artisan's onchain level (New 0%, Trusted 30%, Pro 50%); the escrow enforces it too.
const Draft = z.object({
  counterparty: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  iAm: z.enum(["client", "artisan"]),
  title: z.string().min(3).max(120), description: z.string().max(2000).default(""),
  deliverables: z.array(z.string().min(1).max(200)).min(1).max(10),
  doneMeans: z.string().min(3).max(500), skills: z.array(z.string().min(1).max(30)).max(5).default([]),
  revisions: z.number().int().min(0).max(5).default(1), deadline: z.number().int().positive(),
  deadlockRule: z.enum(["Split5050", "ToClient", "ToArtisan"]).default("Split5050"),
  total: z.number().int().positive().optional(), upfrontBps: z.number().int().min(0).max(5000).optional(), upfront: z.number().int().min(0).optional(), milestones: z.array(z.number().int().positive()).optional(),
});

/** Step 1: write the agreement. We store the exact terms + hash, and return the onchain "propose" call. */
export const POST = route("jobs-create", 30, async (req) => {
  const { wallet } = requireSession(req);
  const d = Draft.parse(await req.json());
  const other = getAddress(d.counterparty);
  if (other.toLowerCase() === wallet) return fail(400, "Pick someone else");
  const them = await db().execute({ sql: "SELECT wallet FROM users WHERE wallet=?", args: [other.toLowerCase()] });
  if (!them.rows.length) return fail(404, "That person has no profile yet");
  const artisanAddr = d.iAm === "artisan" ? getAddress(wallet) : other;
  const { capBps, level } = await artisanLevel(artisanAddr);
  let upfront = d.upfront, milestones = d.milestones;
  if (upfront === undefined || !milestones) {
    if (!d.total) return fail(400, "Give a total, or upfront + milestones");
    ({ upfront, milestones } = defaultSplit(d.total, capBps, d.upfrontBps ?? 0));
  }
  if (upfront > maxUpfront(upfront + milestones.reduce((a, b) => a + b, 0), capBps))
    return fail(400, level.level === 1 ? "Upfront payment unlocks at the Trusted level. This job pays on approval." : `${level.name} artisans can take up to ${capBps / 100}% upfront`);
  if (d.deadline * 1000 < Date.now() + 2 * 3600_000) return fail(400, "Pick a deadline at least 2 hours from now, so the other side has time to accept.");
  const me = getAddress(wallet);
  const terms = TermsSchema.parse({
    version: 1, client: d.iAm === "client" ? me : other, artisan: d.iAm === "artisan" ? me : other, title: d.title, description: d.description,
    deliverables: d.deliverables, doneMeans: d.doneMeans, skills: d.skills, revisions: d.revisions, deadline: d.deadline, upfront, milestones, deadlockRule: d.deadlockRule,
  });
  const hash = hashTerms(terms), id = crypto.randomUUID();
  await db().execute({
    sql: "INSERT INTO jobs(id,client,artisan,terms,terms_hash,skills,status,created_at) VALUES(?,?,?,?,?,?,'Draft',?)",
    args: [id, terms.client.toLowerCase(), terms.artisan.toLowerCase(), JSON.stringify(terms), hash, JSON.stringify(terms.skills.map((s) => s.toLowerCase())), Date.now()],
  });
  if (touchesNative([terms.client, terms.artisan])) after(() => runNative().catch((e) => console.error("[native]", e))); // the agent answers right away, even before signing
  return ok({ id, hash, total: totalOf(terms), terms, calls: proposeCalls(terms) }, 201);
});

// My jobs (as client or artisan).
export const GET = route("jobs-list", 120, async (req) => {
  const { wallet } = requireSession(req);
  const r = await db().execute({ sql: "SELECT id, chain_job_id, client, artisan, terms, status, created_at FROM jobs WHERE client=? OR artisan=? ORDER BY created_at DESC LIMIT 100", args: [wallet, wallet] });
  return ok({ items: r.rows.map((x) => ({ id: String(x.id), chainJobId: x.chain_job_id == null ? null : Number(x.chain_job_id), client: String(x.client), artisan: String(x.artisan), status: String(x.status), terms: JSON.parse(String(x.terms)), createdAt: Number(x.created_at) })) });
});
