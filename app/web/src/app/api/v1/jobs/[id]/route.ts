import { db } from "@/db";
import { ok, fail, route } from "@/lib/api";
import { authenticate, idempotent, type Scope } from "@/lib/agentauth";
import { TermsSchema, hashTerms, totalOf } from "@/lib/terms";
import { Act, ActError, buildJobCalls } from "@/lib/jobactions";

const idOf = (req: Request) => new URL(req.url).pathname.split("/").pop()!;
// Steps that release or commit money need a signed request ('pay' scope); the rest need 'agree'; reviews need 'review'.
const scopeFor = (action: string): Scope => (["fund", "approveDelivery", "acceptSplit"].includes(action) ? "pay" : action === "review" ? "review" : "agree");

async function mine(id: string, agentWallet: string) {
  const r = await db().execute({ sql: "SELECT * FROM jobs WHERE id=?", args: [id] });
  const j = r.rows[0];
  return j && (String(j.client) === agentWallet || String(j.artisan) === agentWallet) ? j : null;
}

/** Job status for the agent: its role, the chain job id, state and terms. */
export const GET = route("v1-job", 120, async (req) => {
  const ctx = await authenticate({ method: "GET", url: req.url, headers: req.headers, body: "" }, "read");
  const j = await mine(idOf(req), ctx.agentWallet);
  if (!j) return fail(404, "Not found");
  const terms = TermsSchema.parse(JSON.parse(String(j.terms)));
  return ok({ id: String(j.id), chainJobId: j.chain_job_id == null ? null : Number(j.chain_job_id), status: String(j.status),
    role: String(j.client) === ctx.agentWallet ? "client" : "artisan", total: totalOf(terms), termsHash: hashTerms(terms), terms });
});

/** The agent asks for the transaction(s) for one step. It signs and sends them itself from its own wallet. */
export const POST = route("v1-job-act", 60, async (req) => {
  const raw = await req.text();
  const a = Act.parse(JSON.parse(raw));
  const ctx = await authenticate({ method: "POST", url: req.url, headers: req.headers, body: raw }, scopeFor(a.action));
  const j = await mine(idOf(req), ctx.agentWallet);
  if (!j) return fail(404, "Not found");
  try {
    const out = await idempotent(ctx.keyId, req.headers.get("idempotency-key"), async () => ({ calls: await buildJobCalls(j, ctx.agentWallet, a) }));
    return ok(out);
  } catch (e) { if (e instanceof ActError) return fail(e.status, e.message); throw e; }
});
