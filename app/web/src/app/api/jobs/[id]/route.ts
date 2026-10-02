import { z } from "zod";
import { keccak256, toBytes } from "viem";
import { db } from "@/db";
import { ok, fail, route } from "@/lib/api";
import { requireSession } from "@/lib/session";
import { TermsSchema, hashTerms, totalOf } from "@/lib/terms";
import { imageUrl } from "@/lib/images";
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
  const cid = j.chain_job_id == null ? null : Number(j.chain_job_id);
  // What the invoice screen shows: states, money and receipt links come from chain_events, not from us.
  const ev = cid == null ? [] : (await db().execute({ sql: "SELECT name, tx, ts, args FROM chain_events WHERE contract='escrow' AND json_extract(args,'$.jobId')=? ORDER BY block, id", args: [String(cid)] })).rows
    .map((e) => ({ event: String(e.name), tx: String(e.tx), ts: e.ts ? Number(e.ts) : null, args: JSON.parse(String(e.args ?? "{}")) as Record<string, unknown> }));
  const released = ev.filter((e) => e.event === "Released").reduce((a, e) => a + Number(e.args.net ?? 0) + Number(e.args.fee ?? 0), 0);
  const offers = ev.filter((e) => e.event === "SplitOffered"), opened = ev.filter((e) => e.event === "SettlementOpened").at(-1);
  const lastOffer = offers.at(-1);
  const party = async (w: string) => (await db().execute({ sql: "SELECT handle, display_name, avatar FROM users WHERE wallet=?", args: [w] })).rows[0];
  const [c, a] = [await party(String(j.client)), await party(String(j.artisan))];
  const card = (w: string, r: typeof c) => ({ wallet: w, handle: r ? String(r.handle) : null, name: r ? String(r.display_name) : w.slice(0, 8), avatar: r?.avatar ? imageUrl(String(r.avatar)) : null });
  return ok({
    id: String(j.id), chainJobId: cid, status: String(j.status), terms, termsHash: hashTerms(terms), me: isMeRole(wallet, j),
    client: card(String(j.client), c), artisan: card(String(j.artisan), a), total: totalOf(terms), released,
    deadlockAt: opened ? Number(opened.args.deadlockAt ?? 0) : null,
    splitOffer: lastOffer ? { by: String(lastOffer.args.by).toLowerCase(), toArtisan: Number(lastOffer.args.toArtisan), toClient: Number(lastOffer.args.toClient) } : null,
    timeline: ev.map(({ event, tx, ts }) => ({ event, tx, ts })),
  });
});
const isMeRole = (wallet: string, j: Record<string, unknown>) => (String(j.client) === wallet ? "client" : "artisan");

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
