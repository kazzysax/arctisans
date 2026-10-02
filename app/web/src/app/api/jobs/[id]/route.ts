import { z } from "zod";
import { keccak256, toBytes } from "viem";
import { db } from "@/db";
import { ok, fail, route } from "@/lib/api";
import { requireSession } from "@/lib/session";
import { TermsSchema, hashTerms } from "@/lib/terms";
import { fundCalls, jobActionCalls, reviewCalls, type JobAction } from "@/lib/tx";

async function load(id: string) {
  const r = await db().execute({ sql: "SELECT * FROM jobs WHERE id=?", args: [id] });
  return r.rows[0] ?? null;
}
const idOf = (req: Request) => new URL(req.url).pathname.split("/").pop()!;

export const GET = route("job", 120, async (req) => {
  const { wallet } = requireSession(req);
  const j = await load(idOf(req));
  if (!j || (String(j.client) !== wallet && String(j.artisan) !== wallet)) return fail(404, "Not found");
  const terms = TermsSchema.parse(JSON.parse(String(j.terms)));
  return ok({
    id: String(j.id), chainJobId: j.chain_job_id == null ? null : Number(j.chain_job_id), status: String(j.status), terms, termsHash: hashTerms(terms),
    // What the invoice screen shows: states and receipt links come from chain_events, not from us.
    timeline: (await db().execute({ sql: "SELECT name, tx, ts FROM chain_events WHERE contract='escrow' AND json_extract(args,'$.jobId')=? ORDER BY block, id", args: [String(j.chain_job_id ?? -1)] })).rows.map((e) => ({ event: String(e.name), tx: String(e.tx), ts: e.ts ? Number(e.ts) : null })),
  });
});

const Act = z.discriminatedUnion("action", [
  z.object({ action: z.literal("fund") }),
  z.object({ action: z.literal("agree") }),
  z.object({ action: z.enum(["start", "cancel", "approveDelivery", "openSettlement", "poke"]) }),
  z.object({ action: z.enum(["postProgress", "deliver", "requestRevision"]), note: z.string().max(1000).default("") }),
  z.object({ action: z.enum(["offerSplit", "acceptSplit"]), toArtisan: z.number().int().min(0) }),
  z.object({ action: z.literal("review"), rating: z.number().int().min(1).max(5), body: z.string().max(1000).default("") }),
]);

/** Returns the exact call(s) for the user to confirm. Only the right party gets the call; the contract enforces it again. */
export const POST = route("job-act", 60, async (req) => {
  const { wallet } = requireSession(req);
  const j = await load(idOf(req));
  if (!j) return fail(404, "Not found");
  const isClient = String(j.client) === wallet, isArtisan = String(j.artisan) === wallet;
  if (!isClient && !isArtisan) return fail(404, "Not found");
  const terms = TermsSchema.parse(JSON.parse(String(j.terms)));
  const a = Act.parse(await req.json());
  const cid = j.chain_job_id == null ? null : Number(j.chain_job_id);
  if (cid === null) return fail(409, "Waiting for the agreement to be proposed onchain");
  const clientOnly = ["fund", "approveDelivery", "requestRevision"], artisanOnly = ["agree", "start", "postProgress", "deliver"];
  if (clientOnly.includes(a.action) && !isClient) return fail(403, "Only the client can do this");
  if (artisanOnly.includes(a.action) && !isArtisan) return fail(403, "Only the artisan can do this");
  const noteHash = (note: string) => keccak256(toBytes(`${cid}:${a.action}:${note}`));
  let calls;
  switch (a.action) {
    case "fund": calls = fundCalls(cid, terms); break;
    case "agree": calls = jobActionCalls(cid, { action: "agree", termsHash: hashTerms(terms) }); break;
    case "postProgress": case "deliver": case "requestRevision": calls = jobActionCalls(cid, { action: a.action, hash: noteHash(a.note) } as JobAction); break;
    case "offerSplit": case "acceptSplit": calls = jobActionCalls(cid, { action: a.action, toArtisan: a.toArtisan }); break;
    case "review": {
      const subject = (isClient ? terms.artisan : terms.client) as `0x${string}`;
      const rh = keccak256(toBytes(`${cid}:${wallet}:${a.rating}:${a.body}`));
      await db().execute({ sql: "UPDATE reviews SET body=? WHERE job_chain_id=? AND reviewer=?", args: [a.body, cid, wallet] }); // text lands once the event is indexed
      calls = reviewCalls(cid, subject, a.rating, rh); break;
    }
    default: calls = jobActionCalls(cid, { action: a.action });
  }
  return ok({ calls });
});
