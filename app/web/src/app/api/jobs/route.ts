import { z } from "zod";
import { getAddress } from "viem";
import { db } from "@/db";
import { ok, fail, route } from "@/lib/api";
import { requireSession } from "@/lib/session";
import { TermsSchema, hashTerms, defaultSplit, totalOf } from "@/lib/terms";
import { proposeCalls } from "@/lib/tx";

// Draft body: either explicit upfront/milestones, or just `total` (+ optional `milestoneCount`) for the default 50/50.
const Draft = z.object({
  counterparty: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  iAm: z.enum(["client", "artisan"]),
  title: z.string().min(3).max(120), description: z.string().max(2000).default(""),
  deliverables: z.array(z.string().min(1).max(200)).min(1).max(10),
  doneMeans: z.string().min(3).max(500), skills: z.array(z.string().min(1).max(30)).max(5).default([]),
  revisions: z.number().int().min(0).max(5).default(1), deadline: z.number().int().positive(),
  deadlockRule: z.enum(["Split5050", "ToClient", "ToArtisan"]).default("Split5050"),
  total: z.number().int().positive().optional(), upfront: z.number().int().min(0).optional(), milestones: z.array(z.number().int().positive()).optional(),
});

/** Step 1: write the agreement. We store the exact terms + hash, and return the onchain "propose" call. */
export const POST = route("jobs-create", 30, async (req) => {
  const { wallet } = requireSession(req);
  const d = Draft.parse(await req.json());
  const other = getAddress(d.counterparty);
  if (other.toLowerCase() === wallet) return fail(400, "Pick someone else");
  const them = await db().execute({ sql: "SELECT wallet FROM users WHERE wallet=?", args: [other.toLowerCase()] });
  if (!them.rows.length) return fail(404, "That person has no profile yet");
  let upfront = d.upfront, milestones = d.milestones;
  if (upfront === undefined || !milestones) {
    if (!d.total) return fail(400, "Give a total, or upfront + milestones");
    ({ upfront, milestones } = defaultSplit(d.total));
  }
  if (d.deadline * 1000 <= Date.now()) return fail(400, "Deadline must be in the future");
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
  return ok({ id, hash, total: totalOf(terms), terms, calls: proposeCalls(terms) }, 201);
});

// My jobs (as client or artisan).
export const GET = route("jobs-list", 120, async (req) => {
  const { wallet } = requireSession(req);
  const r = await db().execute({ sql: "SELECT id, chain_job_id, client, artisan, terms, status, created_at FROM jobs WHERE client=? OR artisan=? ORDER BY created_at DESC LIMIT 100", args: [wallet, wallet] });
  return ok({ items: r.rows.map((x) => ({ id: String(x.id), chainJobId: x.chain_job_id == null ? null : Number(x.chain_job_id), client: String(x.client), artisan: String(x.artisan), status: String(x.status), terms: JSON.parse(String(x.terms)), createdAt: Number(x.created_at) })) });
});
