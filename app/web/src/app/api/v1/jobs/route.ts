import { z } from "zod";
import { getAddress } from "viem";
import { db } from "@/db";
import { ok, fail, route } from "@/lib/api";
import { authenticate, checkSpend, recordSpend, idempotent } from "@/lib/agentauth";
import { TermsSchema, hashTerms, defaultSplit, totalOf } from "@/lib/terms";
import { artisanLevel } from "@/lib/level";
import { proposeCalls } from "@/lib/tx";

const Draft = z.object({
  counterparty: z.string().regex(/^0x[a-fA-F0-9]{40}$/), iAm: z.enum(["client", "artisan"]),
  title: z.string().min(3).max(120), description: z.string().max(2000).default(""), deliverables: z.array(z.string().min(1).max(200)).min(1).max(10),
  doneMeans: z.string().min(3).max(500), skills: z.array(z.string().min(1).max(30)).max(5).default([]), revisions: z.number().int().min(0).max(5).default(1),
  deadline: z.number().int().positive(), deadlockRule: z.enum(["Split5050", "ToClient", "ToArtisan"]).default("Split5050"), total: z.number().int().positive(), upfrontBps: z.number().int().min(0).max(5000).optional(),
});

/** Agents can hire and be hired. As a client the cap is checked against the job total (what will be funded). */
export const POST = route("v1-jobs", 60, async (req) => {
  const raw = await req.text();
  const ctx = await authenticate({ method: "POST", url: req.url, headers: req.headers, body: raw }, "agree");
  const d = Draft.parse(JSON.parse(raw));
  const other = getAddress(d.counterparty);
  if (other.toLowerCase() === ctx.agentWallet) return fail(400, "Pick someone else");
  if ((await db().execute({ sql: "SELECT 1 FROM users WHERE wallet=?", args: [other.toLowerCase()] })).rows.length === 0) return fail(404, "Counterparty has no profile");
  if (d.deadline * 1000 <= Date.now()) return fail(400, "Deadline must be in the future");
  const me = getAddress(ctx.agentWallet);
  // Agents follow the same rule as people: upfront only if the artisan's onchain level allows it.
  const { capBps } = await artisanLevel(d.iAm === "artisan" ? me : other);
  const { upfront, milestones } = defaultSplit(d.total, capBps, d.upfrontBps ?? 0);
  const terms = TermsSchema.parse({ version: 1, client: d.iAm === "client" ? me : other, artisan: d.iAm === "artisan" ? me : other, title: d.title, description: d.description,
    deliverables: d.deliverables, doneMeans: d.doneMeans, skills: d.skills, revisions: d.revisions, deadline: d.deadline, upfront, milestones, deadlockRule: d.deadlockRule });
  const out = await idempotent(ctx.keyId, req.headers.get("idempotency-key"), async () => {
    if (d.iAm === "client") await checkSpend(ctx, totalOf(terms)); // hiring spends money; being hired does not
    const hash = hashTerms(terms), id = crypto.randomUUID();
    await db().execute({ sql: "INSERT INTO jobs(id,client,artisan,terms,terms_hash,skills,status,created_at) VALUES(?,?,?,?,?,?,'Draft',?)",
      args: [id, terms.client.toLowerCase(), terms.artisan.toLowerCase(), JSON.stringify(terms), hash, JSON.stringify(terms.skills.map((s) => s.toLowerCase())), Date.now()] });
    if (d.iAm === "client") await recordSpend(ctx, totalOf(terms), `job:${id}`);
    return { id, hash, total: totalOf(terms), terms, calls: proposeCalls(terms) };
  });
  return ok(out, 201);
});
